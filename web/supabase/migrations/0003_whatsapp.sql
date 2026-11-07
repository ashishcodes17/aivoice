-- WhatsApp: a business connects a WhatsApp Cloud API number to one of its agents; inbound
-- messages (text or voice notes) are answered by that agent, and every message is kept.

create table whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  phone_number_id text not null unique,   -- Meta's id for the number (not the phone number itself)
  waba_id text,
  display_number text,
  access_token text not null,             -- server-side only; never selected from the browser
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index whatsapp_accounts_org_idx on whatsapp_accounts(org_id);

create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  account_id uuid not null references whatsapp_accounts(id) on delete cascade,
  wa_message_id text unique,              -- Meta retries webhooks; this makes each message count once
  contact_number text not null,
  contact_name text,
  direction call_direction not null,
  kind text not null default 'text',      -- text | audio
  content text not null default '',       -- the text, or the transcript of a voice note
  created_at timestamptz not null default now()
);
create index whatsapp_messages_thread_idx on whatsapp_messages(account_id, contact_number, created_at desc);

alter table whatsapp_accounts enable row level security;
alter table whatsapp_messages enable row level security;

-- Members can read their org's messages and see which numbers are connected, but never the access
-- token: browser roles get column-level SELECT without it. Only the service role (the worker) reads it.
create policy whatsapp_accounts_read on whatsapp_accounts for select using (is_member(org_id));
create policy whatsapp_messages_read on whatsapp_messages for select using (is_member(org_id));

revoke all on whatsapp_accounts from anon, authenticated;
grant select (id, org_id, agent_id, phone_number_id, waba_id, display_number, enabled, created_at)
  on whatsapp_accounts to authenticated;
