-- Core schema: multi-tenant orgs, agents, numbers, calls, wallet ledger.

create extension if not exists "pgcrypto";

create type member_role as enum ('owner', 'admin', 'member');
create type call_direction as enum ('inbound', 'outbound');
create type call_status as enum ('initiated', 'answered', 'ended', 'completed', 'failed');
create type ledger_kind as enum ('topup', 'call_debit', 'refund', 'adjustment');
create type payment_status as enum ('created', 'captured', 'failed');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index members_user_idx on members(user_id);

create table agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  system_prompt text not null default '',
  first_message text not null default '',
  language text not null default 'en-IN',
  llm_model text not null default 'openai/gpt-4o-mini',
  stt_provider text not null default 'sarvam',
  tts_provider text not null default 'sarvam',
  tts_voice text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index agents_org_idx on agents(org_id);

create table phone_numbers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  did_number text not null unique,
  voicelink_bot_id integer,
  created_at timestamptz not null default now()
);
create index phone_numbers_org_idx on phone_numbers(org_id);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent_id uuid not null references agents(id),
  phone_number_id uuid not null references phone_numbers(id),
  name text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
create index campaigns_org_idx on campaigns(org_id);

create table calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  voicelink_call_sid text unique,
  direction call_direction not null,
  status call_status not null default 'initiated',
  from_number text,
  to_number text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  cost_paise bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index calls_org_created_idx on calls(org_id, created_at desc);

create table call_transcripts (
  id bigint generated always as identity primary key,
  call_id uuid not null references calls(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  created_at timestamptz not null default now()
);
create index call_transcripts_call_idx on call_transcripts(call_id, id);

-- Append-only wallet ledger; balance = sum(amount_paise). Positive = credit.
create table wallet_ledger (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  kind ledger_kind not null,
  amount_paise bigint not null,
  call_id uuid references calls(id) on delete set null,
  payment_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index wallet_ledger_org_idx on wallet_ledger(org_id, id desc);

create table payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  amount_paise bigint not null check (amount_paise > 0),
  status payment_status not null default 'created',
  created_at timestamptz not null default now()
);
create index payments_org_idx on payments(org_id);

create view wallet_balances with (security_invoker = true) as
  select org_id, coalesce(sum(amount_paise), 0)::bigint as balance_paise
  from wallet_ledger group by org_id;

-- Idempotent top-up credit: safe if the webhook and client verify both fire.
create or replace function credit_payment(p_order_id text, p_payment_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_pay payments;
begin
  select * into v_pay from payments where razorpay_order_id = p_order_id for update;
  if not found or v_pay.status = 'captured' then return false; end if;
  update payments set status = 'captured', razorpay_payment_id = p_payment_id where id = v_pay.id;
  insert into wallet_ledger (org_id, kind, amount_paise, payment_id, note)
    values (v_pay.org_id, 'topup', v_pay.amount_paise, v_pay.id, 'Razorpay top-up');
  return true;
end $$;
revoke execute on function credit_payment(text, text) from public, anon, authenticated;

-- Row Level Security: a user sees only orgs they belong to.
create or replace function is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where org_id = p_org and user_id = auth.uid());
$$;

alter table organizations enable row level security;
alter table members enable row level security;
alter table agents enable row level security;
alter table phone_numbers enable row level security;
alter table campaigns enable row level security;
alter table calls enable row level security;
alter table call_transcripts enable row level security;
alter table wallet_ledger enable row level security;
alter table payments enable row level security;

create policy org_read on organizations for select using (is_member(id));
create policy members_read on members for select using (user_id = auth.uid() or is_member(org_id));
create policy agents_all on agents for all using (is_member(org_id)) with check (is_member(org_id));
create policy numbers_all on phone_numbers for all using (is_member(org_id)) with check (is_member(org_id));
create policy campaigns_all on campaigns for all using (is_member(org_id)) with check (is_member(org_id));
-- Calls, transcripts, ledger and payments are written by the service role only.
create policy calls_read on calls for select using (is_member(org_id));
create policy transcripts_read on call_transcripts for select using (is_member(org_id));
create policy ledger_read on wallet_ledger for select using (is_member(org_id));
create policy payments_read on payments for select using (is_member(org_id));

-- Create an org and owner membership for the calling user.
create or replace function create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into organizations (name) values (p_name) returning id into v_org;
  insert into members (org_id, user_id, role) values (v_org, auth.uid(), 'owner');
  return v_org;
end $$;
