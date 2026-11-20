-- Initial private per-user data model for ALI FITNESS PRO.
-- Uses Supabase Auth identities and row-level security on every personal table.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  age integer check (age >= 13 and age <= 100),
  sex text check (sex in ('male','female','other','prefer_not_to_say')),
  height_cm numeric check (height_cm >= 80 and height_cm <= 250),
  dietary_pattern text,
  dietary_preferences jsonb not null default '{}'::jsonb,
  training_experience text,
  goal text,
  available_days jsonb not null default '[]'::jsonb,
  preferred_training_times jsonb not null default '[]'::jsonb,
  health_constraints jsonb not null default '{}'::jsonb,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.body_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at date not null default current_date,
  weight_kg numeric check (weight_kg >= 20 and weight_kg <= 400),
  waist_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  goal text,
  level text,
  phase text,
  starts_on date,
  ends_on date,
  plan_data jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  exercise_name text not null,
  performed_at timestamptz not null default now(),
  sets_data jsonb not null default '[]'::jsonb,
  notes text
);

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  water_target_ml integer,
  plan_data jsonb not null default '{}'::jsonb,
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_hydration (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  amount_ml integer not null check (amount_ml > 0 and amount_ml <= 10000),
  created_at timestamptz not null default now()
);

create table if not exists public.supplement_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplement_name text not null,
  purpose text,
  recommendation_data jsonb not null default '{}'::jsonb,
  product_data jsonb not null default '{}'::jsonb,
  clinician_review_required boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists body_assessments_user_date_idx
  on public.body_assessments (user_id, measured_at desc);
create index if not exists workout_plans_user_active_idx
  on public.workout_plans (user_id, is_active, created_at desc);
create index if not exists workout_logs_plan_id_idx
  on public.workout_logs (plan_id);
create index if not exists daily_hydration_user_date_idx
  on public.daily_hydration (user_id, log_date desc);

alter table public.profiles enable row level security;
alter table public.body_assessments enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_logs enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.daily_hydration enable row level security;
alter table public.supplement_plans enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.body_assessments to authenticated;
grant select, insert, update, delete on public.workout_plans to authenticated;
grant select, insert, update, delete on public.workout_logs to authenticated;
grant select, insert, update, delete on public.nutrition_plans to authenticated;
grant select, insert, update, delete on public.daily_hydration to authenticated;
grant select, insert, update, delete on public.supplement_plans to authenticated;

drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users manage own body assessments" on public.body_assessments;
create policy "Users manage own body assessments" on public.body_assessments
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own workout plans" on public.workout_plans;
create policy "Users manage own workout plans" on public.workout_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own workout logs" on public.workout_logs;
create policy "Users manage own workout logs" on public.workout_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own nutrition plans" on public.nutrition_plans;
create policy "Users manage own nutrition plans" on public.nutrition_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own hydration logs" on public.daily_hydration;
create policy "Users manage own hydration logs" on public.daily_hydration
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own supplement plans" on public.supplement_plans;
create policy "Users manage own supplement plans" on public.supplement_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
