alter table public.profiles
  add column if not exists activity_level text not null default 'light'
  check (activity_level in ('sedentary','light','moderate','active','very_active'));
