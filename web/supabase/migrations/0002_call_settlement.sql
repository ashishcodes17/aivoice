-- One debit per call, enforced by the database so webhook retries are safe.
create unique index wallet_ledger_one_debit_per_call
  on wallet_ledger(call_id) where kind = 'call_debit';

create or replace function settle_call(
  p_org uuid, p_call_sid text, p_direction call_direction,
  p_from text, p_to text, p_duration integer, p_rate_paise_per_min integer
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_call uuid;
  v_cost bigint := ceil(p_duration / 60.0)::bigint * p_rate_paise_per_min;
begin
  insert into calls (org_id, voicelink_call_sid, direction, status, from_number, to_number,
                     duration_seconds, cost_paise, ended_at)
    values (p_org, p_call_sid, p_direction, 'ended', p_from, p_to, p_duration, v_cost, now())
  on conflict (voicelink_call_sid) do update
    set status = 'ended', duration_seconds = excluded.duration_seconds,
        cost_paise = excluded.cost_paise, ended_at = now()
  returning id into v_call;

  if v_cost > 0 then
    insert into wallet_ledger (org_id, kind, amount_paise, call_id, note)
      values (p_org, 'call_debit', -v_cost, v_call, 'Call usage')
    on conflict do nothing;
  end if;
end $$;
revoke execute on function settle_call(uuid, text, call_direction, text, text, integer, integer)
  from public, anon, authenticated;
