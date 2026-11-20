drop policy if exists "No client access to AI coach requests" on public.ai_coach_requests;
create policy "No client access to AI coach requests"
  on public.ai_coach_requests
  for all to anon, authenticated
  using (false)
  with check (false);
