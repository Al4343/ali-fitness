import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, ui, data] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/app-ui.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/app-data.js', import.meta.url), 'utf8'),
]);

assert.match(html, /\.\/assets\/app\.css/);
assert.match(html, /\.\/assets\/app-ui\.js/);
assert.match(html, /\.\/assets\/app-data\.js/);
assert.match(html, /id="daytabs"/);
assert.match(ui, /async function day\(i\)/);
assert.match(ui, /window\.applySchedule=/);
assert.match(ui, /window\.getActiveSchedule=/);
assert.match(ui, /window\.restoreWorkoutPlan=/);
assert.match(data, /window\.applySchedule\(p\)/);
assert.match(data, /window\.getScheduledWeekdays\?\./);
assert.match(data, /window\.restoreWorkoutPlan\(wp\.data\[0\]\.plan_data\)/);
assert.match(data, /activity_level/);
assert.match(data, /window\.saveWorkoutSession/);
assert.match(data, /window\.fetchWorkoutSession/);
assert.doesNotMatch(data, /\b(activeSchedule|activeScheduleBase|didx|renderDay)\b/);

const declaredIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
const referencedIds = [...(ui + '\n' + data).matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
const createdAtRuntime = new Set(['mealDayTitle', 'mealDayPanel', 'weeklyShopping']);
const missing = [...new Set(referencedIds)].filter((id) => !declaredIds.has(id) && !createdAtRuntime.has(id));
assert.deepEqual(missing, [], 'Every statically referenced DOM id must exist in index.html');

console.log('ALI FITNESS PRO smoke checks passed.');
