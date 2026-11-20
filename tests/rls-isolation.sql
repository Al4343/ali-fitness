\set ON_ERROR_STOP on

-- Exercise the actual ownership policies as two authenticated identities.
insert into auth.users (id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222')
on conflict do nothing;

insert into public.profiles (id, display_name) values
  ('11111111-1111-4111-8111-111111111111', 'User A'),
  ('22222222-2222-4222-8222-222222222222', 'User B');

insert into public.body_assessments (user_id, weight_kg) values
  ('11111111-1111-4111-8111-111111111111', 70),
  ('22222222-2222-4222-8222-222222222222', 80);
insert into public.workout_plans (user_id, title) values
  ('11111111-1111-4111-8111-111111111111', 'Plan A'),
  ('22222222-2222-4222-8222-222222222222', 'Plan B');
insert into public.workout_logs (user_id, exercise_name) values
  ('11111111-1111-4111-8111-111111111111', 'Exercise A'),
  ('22222222-2222-4222-8222-222222222222', 'Exercise B');
insert into public.nutrition_plans (user_id, title) values
  ('11111111-1111-4111-8111-111111111111', 'Nutrition A'),
  ('22222222-2222-4222-8222-222222222222', 'Nutrition B');
insert into public.daily_hydration (user_id, amount_ml) values
  ('11111111-1111-4111-8111-111111111111', 500),
  ('22222222-2222-4222-8222-222222222222', 600);
insert into public.supplement_plans (user_id, supplement_name) values
  ('11111111-1111-4111-8111-111111111111', 'Supplement A'),
  ('22222222-2222-4222-8222-222222222222', 'Supplement B');
insert into public.workout_sessions (user_id, day_index, day_title) values
  ('11111111-1111-4111-8111-111111111111', 0, 'Session A'),
  ('22222222-2222-4222-8222-222222222222', 0, 'Session B');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $test$
declare n integer;
begin
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'User A profile isolation failed: %', n; end if;
  select count(*) into n from public.body_assessments;
  if n <> 1 then raise exception 'User A body assessment isolation failed: %', n; end if;
  select count(*) into n from public.workout_plans;
  if n <> 1 then raise exception 'User A workout plan isolation failed: %', n; end if;
  select count(*) into n from public.workout_logs;
  if n <> 1 then raise exception 'User A workout log isolation failed: %', n; end if;
  select count(*) into n from public.nutrition_plans;
  if n <> 1 then raise exception 'User A nutrition plan isolation failed: %', n; end if;
  select count(*) into n from public.daily_hydration;
  if n <> 1 then raise exception 'User A hydration isolation failed: %', n; end if;
  select count(*) into n from public.supplement_plans;
  if n <> 1 then raise exception 'User A supplement isolation failed: %', n; end if;
  select count(*) into n from public.workout_sessions;
  if n <> 1 then raise exception 'User A workout session isolation failed: %', n; end if;
  update public.body_assessments set weight_kg = 999
   where user_id = '22222222-2222-4222-8222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'User A modified User B body assessment'; end if;
  begin
    insert into public.body_assessments (user_id, weight_kg)
    values ('22222222-2222-4222-8222-222222222222', 90);
    raise exception 'User A inserted a row for User B';
  exception when insufficient_privilege then null;
  end;
end
$test$;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $test$
declare n integer;
begin
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'User B profile isolation failed'; end if;
  select count(*) into n from public.workout_sessions;
  if n <> 1 then raise exception 'User B workout session isolation failed'; end if;
end
$test$;
reset role;
