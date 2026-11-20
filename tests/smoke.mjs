import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, ui, data, coach, baseMigration, sessionsMigration, aiUsageMigration, denyAiUsageMigration] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/app-ui.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/app-data.js', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/fitness-coach/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261113155143_fitness_user_accounts_and_private_data.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261113174006_add_persistent_workout_sessions.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261113180000_add_ai_coach_consent_and_usage.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261113180500_deny_client_access_to_ai_coach_usage.sql', import.meta.url), 'utf8'),
]);

assert.match(html, /\.\/assets\/app\.css/);
assert.match(html, /\.\/assets\/app-ui\.js/);
assert.match(html, /\.\/assets\/app-data\.js/);
assert.match(html, /id="daytabs"/);
assert.match(html, /id="coach"/);
assert.match(html, /id="aiConsent"/);
assert.match(html, /id="aiCoachChat"/);
assert.match(ui, /async function day\(i\)/);
assert.match(ui, /window\.applySchedule=/);
assert.match(ui, /window\.getActiveSchedule=/);
assert.match(ui, /window\.restoreWorkoutPlan=/);
assert.match(data, /window\.applySchedule\(p\)/);
assert.match(data, /window\.getScheduledWeekdays\?\./);
assert.match(data, /window\.restoreWorkoutPlan\(wp\.data\[0\]\.plan_data\)/);
assert.match(data, /activity_level/);
assert.match(data, /window\.updateFitnessProfile=/);
assert.match(data, /function loadProfileSettings/);
assert.match(data, /onboarding_completed:false/);
assert.match(data, /const plansCreated=await createInitialPlans/);
assert.match(data, /return true;/);
assert.match(data, /let sessionReadyUserId=null,sessionReadyPromise=null/);
assert.match(data, /sessionReadyUserId===s.user.id&&sessionReadyPromise/);
assert.match(data, /window\.saveWorkoutSession/);
assert.match(data, /window\.fetchWorkoutSession/);
assert.match(data, /db\.functions\.invoke\('fitness-coach'/);
assert.match(data, /window\.saveAiConsent=/);
assert.match(coach, /https:\/\/api\.openai\.com\/v1\/responses/);
assert.match(coach, /ai_coach_consent/);
assert.match(coach, />= 5/);
assert.doesNotMatch(coach, /health_constraints|body_assessments/);

// Security regression checks: all personal tables must keep RLS and ownership checks.
for (const table of ['profiles', 'body_assessments', 'workout_plans', 'workout_logs', 'nutrition_plans', 'daily_hydration', 'supplement_plans']) {
  assert.ok(baseMigration.includes(`alter table public.${table} enable row level security`), `${table} must keep RLS enabled`);
  assert.ok(baseMigration.includes(`create policy `) && baseMigration.includes(`on public.${table}`), `${table} must have an ownership policy`);
}
assert.ok(baseMigration.includes('using ((select auth.uid()) = id)'));
assert.ok(baseMigration.includes('with check ((select auth.uid()) = id)'));
assert.ok(baseMigration.includes('using ((select auth.uid()) = user_id)'));
assert.ok(baseMigration.includes('with check ((select auth.uid()) = user_id)'));
assert.ok(sessionsMigration.includes('alter table public.workout_sessions enable row level security'));
assert.ok(sessionsMigration.includes('using ((select auth.uid()) = user_id)'));
assert.ok(sessionsMigration.includes('with check ((select auth.uid()) = user_id)'));
assert.ok(denyAiUsageMigration.includes('for all to anon, authenticated'));
assert.ok(denyAiUsageMigration.includes('using (false)'));
assert.ok(denyAiUsageMigration.includes('with check (false)'));
assert.ok(aiUsageMigration.includes('revoke all on public.ai_coach_requests from anon, authenticated'));
assert.doesNotMatch(data, /\b(activeSchedule|activeScheduleBase|didx|renderDay)\b/);

const declaredIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
const referencedIds = [...(ui + '\n' + data).matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
const createdAtRuntime = new Set(['mealDayTitle', 'mealDayPanel', 'weeklyShopping']);
const missing = [...new Set(referencedIds)].filter((id) => !declaredIds.has(id) && !createdAtRuntime.has(id));
assert.deepEqual(missing, [], 'Every statically referenced DOM id must exist in index.html');

console.log('ALI FITNESS PRO smoke checks passed.');
