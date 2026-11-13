# ALI FITNESS PRO

Arabic-first personal training and nutrition web app. Designed for mobile first, with individual Supabase accounts and private per-user training data.

## Product features

- Email/password authentication and per-user profile onboarding.
- Personalized weekly split for 1–6 selected training days, training experience, daily activity level, and preferred training time.
- Exercise library with exercise images, technique instructions, muscle groups, and equipment alternatives.
- Workout completion tracking, previous-performance prefill, and workout-set logging.
- Body measurements: weight, waist, chest, arm, and thigh.
- Seven-day meal calendar with ingredients, preparation steps, and dietary-pattern substitutions.
- Nutrition estimates based on age, height, weight, goal, and self-reported daily activity. Users under 18 do not receive calorie or macro targets.
- Supplement education with safety notes.
- Rule-based performance review plus an optional OpenAI-powered coach chat. The AI coach is consent-gated, uses a server-side Edge Function, and never changes weights automatically.

## Architecture

- `index.html`: Arabic RTL application shell.
- `assets/app.css`: responsive design system.
- `assets/app-ui.js`: workout UI, schedule generation, and browser interactions.
- `assets/app-data.js`: Supabase Auth, data access, nutrition calculations, progress analysis, and AI chat client.\n- `supabase/functions/fitness-coach/index.ts`: authenticated AI coach Edge Function.
- `supabase/migrations/`: database schema and RLS migrations.
- `tests/smoke.mjs`: static integration smoke checks.
- `.github/workflows/validate.yml`: syntax and smoke-test workflow.

## Supabase setup

1. Create a Supabase project.
2. Apply the SQL migrations in timestamp order.
3. In `assets/app-data.js`, configure the project URL and **publishable** client key for that Supabase project.
4. Never put a Supabase `service_role` key in browser code or commit it to Git.
5. Configure Supabase Auth email confirmation and the correct production redirect URLs for the deployed domain.
6. Keep Row Level Security enabled. Every personal table must retain its user-ownership policy.\n7. In Supabase Dashboard → Edge Functions → Secrets, add `OPENAI_API_KEY`. Optionally set `OPENAI_MODEL`; the current default is `gpt-6-luna`. Never place the API key in browser code or Git.\n8. The deployed `fitness-coach` function returns a setup error until the OpenAI secret is configured.

The client-side publishable key is expected to be visible in a static web app. Data privacy is enforced by Supabase Auth and RLS policies, not by hiding that key.\n\nThe AI coach sends only the consenting user's selected profile fields and last 28 days of workout logs/sessions to the OpenAI API. It does not send email, injury/health notes, allergy notes, or body measurements. Consent is stored per profile and can be withdrawn in the coach screen. The Edge Function enforces a limit of five questions per user per day. OpenAI API usage may incur separate charges.

## Deploy

This is a static site. Publish the repository root with GitHub Pages or Cloudflare Pages. The app uses relative asset paths, so deploy from the repository root or configure the host's base path accordingly.

## Validation

Requires Node.js 22:

```bash
node --check assets/app-ui.js
node --input-type=module --check < assets/app-data.js
node tests/smoke.mjs
```

GitHub Actions runs these checks for pushes and pull requests.

## Important limitations before public launch

- The deterministic progress review is rules-based. The separate AI chat requires an OpenAI API key and explicit per-user consent.
- Real-device visual QA and authenticated end-to-end testing with at least two separate user accounts are still required.
- Nutrition targets and exercise suggestions are general guidance, not medical advice. Allergies and injuries are displayed as cautions; users must verify food labels and exercise suitability with a qualified professional where appropriate.
- Enable Supabase leaked-password protection before production launch.
