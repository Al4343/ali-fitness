import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractAssistantText } from '../supabase/functions/_shared/openai-response.js';

const [html, ui, data, coach, baseMigration, sessionsMigration, indexMigration, activityMigration, aiUsageMigration, denyAiUsageMigration, atomicAiLimitMigration] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/app-ui.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/app-data.js', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/fitness-coach/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261113155143_fitness_user_accounts_and_private_data.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261113174006_add_persistent_workout_sessions.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261113174417_index_workout_sessions_plan_id.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261113175212_add_activity_level_to_fitness_profiles.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261113180149_add_ai_coach_consent_and_usage.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261113180436_deny_client_access_to_ai_coach_usage.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261120154250_atomic_ai_coach_daily_limit.sql', import.meta.url), 'utf8'),
]);

assert.match(html, /\.\/assets\/app\.css/);
assert.match(html, /\.\/assets\/app-ui\.js/);
assert.match(html, /\.\/assets\/app-data\.js/);
assert.match(html, /id="daytabs"/);
assert.match(html, /id="coach"/);
assert.match(html, /id="aiConsent"/);
assert.match(html, /id="aiCoachChat"/);
assert.match(ui, /function safeText\(v\)/);
assert.match(ui, /function renderDay\(\)[\s\S]*?safeText\(e\[0\]\)[\s\S]*?safeText\(e\[1\]\)[\s\S]*?safeText\(e\[4\]\)/);
assert.match(ui, /function openExercise\(dayIndex,index\)[\s\S]*?safeText\(base\+src\)/);
assert.match(ui, /function showLibraryExercise\(name\)[\s\S]*?safeText\(base\+src\)/);
assert.match(ui, /data-exercise-name="'\+safeText\(e\.name\)/);
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
assert.match(coach, /AI_COACH_DAILY_LIMIT/);

const assistantFixture = {
  output: [
    { type: 'reasoning', summary: [] },
    { type: 'function_call', name: 'ignored_tool' },
    { type: 'message', role: 'user', content: [{ type: 'output_text', text: 'ignore user' }] },
    { type: 'message', role: 'assistant', content: [
      { type: 'output_text', text: 'مرحباً' },
      { type: 'refusal', refusal: 'ignored non-text content' },
      { type: 'output_text', text: 'بك' },
    ] },
  ],
};
assert.equal(extractAssistantText(assistantFixture), 'مرحباً بك');
assert.equal(extractAssistantText({ output: [] }), '');
assert.equal(extractAssistantText({ output: null }), '');
assert.equal(extractAssistantText(null), '');
assert.match(coach, /usageError\?\.code === "P0001"/);
assert.doesNotMatch(coach, /const \{ count, error: countError \} = await admin/);
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
assert.ok(indexMigration.includes('create index if not exists workout_sessions_plan_id_idx'));
assert.ok(activityMigration.includes('add column if not exists activity_level'));
assert.ok(sessionsMigration.includes('alter table public.workout_sessions enable row level security'));
assert.ok(sessionsMigration.includes('using ((select auth.uid()) = user_id)'));
assert.ok(sessionsMigration.includes('with check ((select auth.uid()) = user_id)'));
assert.ok(denyAiUsageMigration.includes('for all to anon, authenticated'));
assert.ok(denyAiUsageMigration.includes('using (false)'));
assert.ok(denyAiUsageMigration.includes('with check (false)'));
assert.ok(aiUsageMigration.includes('revoke all on public.ai_coach_requests from anon, authenticated'));
assert.ok(atomicAiLimitMigration.includes('pg_advisory_xact_lock'));
assert.ok(atomicAiLimitMigration.includes('hashtextextended(new.user_id::text, 0)'));
assert.ok(atomicAiLimitMigration.includes("message = 'AI_COACH_DAILY_LIMIT'"));
assert.ok(atomicAiLimitMigration.includes('before insert on public.ai_coach_requests'));
assert.ok(atomicAiLimitMigration.includes('security invoker'));
assert.ok(atomicAiLimitMigration.includes("set search_path = ''"));
assert.doesNotMatch(data, /\b(activeSchedule|activeScheduleBase|didx|renderDay)\b/);

const declaredIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
const referencedIds = [...(ui + '\n' + data).matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
const createdAtRuntime = new Set(['mealDayTitle', 'mealDayPanel', 'weeklyShopping']);
const missing = [...new Set(referencedIds)].filter((id) => !declaredIds.has(id) && !createdAtRuntime.has(id));
assert.deepEqual(missing, [], 'Every statically referenced DOM id must exist in index.html');

console.log('ALI FITNESS PRO smoke checks passed.');
