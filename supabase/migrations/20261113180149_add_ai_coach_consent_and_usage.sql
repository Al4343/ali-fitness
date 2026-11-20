alter table public.profiles
  add column if not exists ai_coach_consent boolean not null default false;

create table if not exists public.ai_coach_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index if not exists ai_coach_requests_user_time_idx
  on public.ai_coach_requests (user_id, requested_at desc);
alter table public.ai_coach_requests enable row level security;
revoke all on public.ai_coach_requests from anon, authenticated;
grant select, insert on public.ai_coach_requests to service_role;
