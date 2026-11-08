-- Free test credit for every account, and rented phone numbers (Rs 350 a month, paid from the wallet).
--
-- Review before running on production. This file:
--   1. adds a ledger kind for number rent,
--   2. gives every organization, existing and new, a one-time Rs 20 test credit,
--   3. adds rental columns to phone_numbers and locks them so users cannot edit their own billing,
--   4. adds number_purchases (an audit trail) and the functions that move money for a purchase or a renewal.

-- 1. A ledger kind for rent. (Added here, used only by the functions below at run time.)
alter type ledger_kind add value if not exists 'number_rental';

-- 2. Free test credit: Rs 20, once per organization.
create unique index if not exists wallet_ledger_one_test_credit
  on wallet_ledger(org_id) where kind = 'adjustment' and note = 'Free test credit';

create or replace function grant_test_credit(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into wallet_ledger (org_id, kind, amount_paise, note)
    values (p_org, 'adjustment', 2000, 'Free test credit')
  on conflict do nothing;
end $$;
revoke execute on function grant_test_credit(uuid) from public, anon, authenticated;

-- New organizations get the credit, but a person who already received it through another
-- organization does not get it again.
create or replace function create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into organizations (name) values (p_name) returning id into v_org;
  insert into members (org_id, user_id, role) values (v_org, auth.uid(), 'owner');
  if not exists (
    select 1 from members m
    join wallet_ledger l on l.org_id = m.org_id
    where m.user_id = auth.uid() and l.kind = 'adjustment' and l.note = 'Free test credit'
  ) then
    perform grant_test_credit(v_org);
  end if;
  return v_org;
end $$;

-- Existing organizations: one-time grant. Safe to re-run; the unique index above stops a second credit.
insert into wallet_ledger (org_id, kind, amount_paise, note)
  select id, 'adjustment', 2000, 'Free test credit' from organizations
on conflict do nothing;

-- 3. Rental columns on phone_numbers.
alter table phone_numbers
  add column if not exists source text not null default 'manual' check (source in ('manual', 'purchased')),
  add column if not exists monthly_fee_paise integer not null default 0,
  add column if not exists voicelink_did_id integer,
  add column if not exists renews_at timestamptz,
  add column if not exists grace_until timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

-- Numbers no account may claim, such as the shared test line.
create table if not exists reserved_dids (did_number text primary key);
alter table reserved_dids enable row level security; -- no policy: only the service role and the trigger below can read it
insert into reserved_dids (did_number) values ('919429490400') on conflict do nothing;

-- Members may edit their numbers (the existing policy), but never the billing columns, may not claim a
-- reserved number, and may not delete a rented number (that goes through the cancel flow, which uses
-- the service role).
create or replace function protect_number_billing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then return coalesce(new, old); end if;
  if tg_op <> 'DELETE' and exists (select 1 from reserved_dids r where right(r.did_number, 10) = right(new.did_number, 10)) then
    raise exception 'That number cannot be connected to an account.';
  end if;
  if tg_op = 'DELETE' then
    if old.source = 'purchased' then raise exception 'A rented number is cancelled from the Numbers page, not deleted.'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    new.source := 'manual';
    new.monthly_fee_paise := 0;
    new.voicelink_did_id := null;
    new.renews_at := null;
    new.grace_until := null;
    new.cancel_at_period_end := false;
  else
    new.source := old.source;
    new.monthly_fee_paise := old.monthly_fee_paise;
    new.voicelink_did_id := old.voicelink_did_id;
    new.renews_at := old.renews_at;
    new.grace_until := old.grace_until;
    new.cancel_at_period_end := old.cancel_at_period_end;
  end if;
  return new;
end $$;

drop trigger if exists phone_numbers_protect_billing on phone_numbers;
create trigger phone_numbers_protect_billing
  before insert or update or delete on phone_numbers
  for each row execute function protect_number_billing();

-- 4. Purchases: one row per attempt, so money and VoiceLink state can always be reconciled.
create type number_purchase_status as enum ('pending', 'active', 'failed', 'needs_attention', 'released');

create table number_purchases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  did_number text not null,
  voicelink_did_id integer,
  price_paise integer not null check (price_paise > 0),
  status number_purchase_status not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index number_purchases_org_idx on number_purchases(org_id, created_at desc);
-- Only one live purchase per number.
create unique index number_purchases_one_live_per_number
  on number_purchases(did_number) where status in ('pending', 'active', 'needs_attention');
alter table number_purchases enable row level security;
create policy number_purchases_read on number_purchases for select using (is_member(org_id));

-- Take the money first and record the attempt, in one step. The per-organization lock stops two
-- simultaneous purchases from both passing the balance check.
create or replace function reserve_number_purchase(p_org uuid, p_did text, p_price integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_balance bigint; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 0));
  select coalesce(sum(amount_paise), 0) into v_balance from wallet_ledger where org_id = p_org;
  if v_balance < p_price then raise exception 'insufficient_balance'; end if;
  if exists (select 1 from phone_numbers where right(did_number, 10) = right(p_did, 10)) then
    raise exception 'number_unavailable';
  end if;
  insert into number_purchases (org_id, did_number, price_paise) values (p_org, p_did, p_price)
    returning id into v_id;  -- fails on the unique index if someone else is buying the same number
  insert into wallet_ledger (org_id, kind, amount_paise, note)
    values (p_org, 'number_rental', -p_price, 'Number rental ' || p_did);
  return v_id;
end $$;

-- The purchase succeeded everywhere: connect the number to the organization.
create or replace function finish_number_purchase(p_id uuid, p_voicelink_did_id integer, p_agent uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p number_purchases;
begin
  select * into p from number_purchases where id = p_id for update;
  if not found or p.status <> 'pending' then raise exception 'purchase_not_pending'; end if;
  insert into phone_numbers (org_id, agent_id, did_number, source, monthly_fee_paise, voicelink_did_id, renews_at)
    values (p.org_id, p_agent, p.did_number, 'purchased', p.price_paise, p_voicelink_did_id, now() + interval '1 month');
  update number_purchases set status = 'active', voicelink_did_id = p_voicelink_did_id, updated_at = now() where id = p_id;
end $$;

-- Give the money back and close the attempt. Only for a purchase that never completed.
create or replace function fail_number_purchase(p_id uuid, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare p number_purchases;
begin
  select * into p from number_purchases where id = p_id for update;
  if not found or p.status <> 'pending' then return; end if;
  update number_purchases set status = 'failed', error = left(p_error, 500), updated_at = now() where id = p_id;
  insert into wallet_ledger (org_id, kind, amount_paise, note)
    values (p.org_id, 'refund', p.price_paise, 'Refund: number ' || p.did_number || ' could not be set up');
end $$;

-- Bought on VoiceLink but a later step failed: keep the money, flag it for a person to finish.
create or replace function flag_number_purchase(p_id uuid, p_error text, p_voicelink_did_id integer)
returns void language sql security definer set search_path = public as $$
  update number_purchases
    set status = 'needs_attention', error = left(p_error, 500), voicelink_did_id = p_voicelink_did_id, updated_at = now()
    where id = p_id and status = 'pending';
$$;

-- Monthly rent for one number. Returns 'renewed' or 'insufficient'. Safe to call twice for the same
-- period: it only acts while renews_at is in the past.
create or replace function renew_number(p_number uuid)
returns text language plpgsql security definer set search_path = public as $$
declare n phone_numbers; v_balance bigint;
begin
  select * into n from phone_numbers where id = p_number for update;
  if not found or n.source <> 'purchased' or n.renews_at is null or n.renews_at > now() then return 'skipped'; end if;
  perform pg_advisory_xact_lock(hashtextextended(n.org_id::text, 0));
  select coalesce(sum(amount_paise), 0) into v_balance from wallet_ledger where org_id = n.org_id;
  if v_balance < n.monthly_fee_paise then return 'insufficient'; end if;
  insert into wallet_ledger (org_id, kind, amount_paise, note)
    values (n.org_id, 'number_rental', -n.monthly_fee_paise, 'Number rental ' || n.did_number);
  update phone_numbers set renews_at = n.renews_at + interval '1 month', grace_until = null where id = p_number;
  return 'renewed';
end $$;

revoke execute on function reserve_number_purchase(uuid, text, integer) from public, anon, authenticated;
revoke execute on function finish_number_purchase(uuid, integer, uuid) from public, anon, authenticated;
revoke execute on function fail_number_purchase(uuid, text) from public, anon, authenticated;
revoke execute on function flag_number_purchase(uuid, text, integer) from public, anon, authenticated;
revoke execute on function renew_number(uuid) from public, anon, authenticated;
