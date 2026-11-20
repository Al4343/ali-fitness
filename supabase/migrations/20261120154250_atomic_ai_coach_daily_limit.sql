create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.enforce_ai_coach_daily_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  request_count bigint;
begin
  -- Serialize inserts for this user until the surrounding transaction commits.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  select pg_catalog.count(*)
    into request_count
    from public.ai_coach_requests
   where user_id = new.user_id
     and requested_at >= pg_catalog.now() - interval '24 hours';

  if request_count >= 5 then
    raise exception using
      errcode = 'P0001',
      message = 'AI_COACH_DAILY_LIMIT';
  end if;

  return new;
end;
$function$;

revoke all on function private.enforce_ai_coach_daily_limit() from public, anon, authenticated, service_role;

drop trigger if exists enforce_ai_coach_daily_limit on public.ai_coach_requests;
create trigger enforce_ai_coach_daily_limit
before insert on public.ai_coach_requests
for each row
execute function private.enforce_ai_coach_daily_limit();
