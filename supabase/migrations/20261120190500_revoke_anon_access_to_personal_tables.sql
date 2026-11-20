-- Personal data tables are only used after authentication.
-- Remove inherited/direct anon grants as defense in depth; RLS ownership
-- policies remain the primary row-level boundary for authenticated users.
revoke all privileges on table
  public.profiles,
  public.body_assessments,
  public.workout_plans,
  public.workout_logs,
  public.nutrition_plans,
  public.daily_hydration,
  public.supplement_plans,
  public.workout_sessions
from anon;
