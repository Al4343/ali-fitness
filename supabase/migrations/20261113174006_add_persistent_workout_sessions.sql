-- Applied to the ALI FITNESS PRO Supabase project.
-- Idempotent so it can also be replayed in a fresh environment after the base schema.
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid null references public.workout_plans(id) on delete set null,
  session_date date not null default current_date,
  day_index smallint not null check (day_index between 0 and 6),
  day_title text not null default '',
  status text not null default 'in_progress'
    check (status in ('in_progress','completed','abandoned')),
  completed_exercises jsonb not null default '[]'::jsonb
    check (jsonb_typeof(completed_exercises) = 'array'),
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (user_id, session_date, day_index)
);

create index if not exists workout_sessions_user_date_idx
  on public.workout_sessions (user_id, session_date desc);
create index if not exists workout_sessions_plan_id_idx
  on public.workout_sessions (plan_id);

alter table public.workout_sessions enable row level security;
grant select, insert, update, delete on public.workout_sessions to authenticated;

drop policy if exists "Users manage their own workout sessions"
  on public.workout_sessions;
create policy "Users manage their own workout sessions"
  on public.workout_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
