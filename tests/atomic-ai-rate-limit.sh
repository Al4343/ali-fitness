#!/usr/bin/env bash
set -euo pipefail

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

user_one="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
user_two="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

# Seed two isolated test identities and one request outside the rolling window.
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
insert into auth.users(id) values ('$user_one'), ('$user_two');
insert into public.ai_coach_requests(id, user_id, requested_at)
values ('a0000000-0000-4000-8000-000000000000', '$user_one', now() - interval '25 hours');
grant select, insert, delete on public.ai_coach_requests to service_role;
SQL

# Race six independent database sessions for the same user.
for i in 1 2 3 4 5 6; do
  id=$(printf 'a0000000-0000-4000-8000-%012d' "$i")
  (
    if psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
      -c "set role service_role; insert into public.ai_coach_requests(id, user_id) values ('$id', '$user_one')" \
      >"$tmp_dir/$i.log" 2>&1; then
      printf 'success\n' >"$tmp_dir/$i.status"
    else
      printf 'failure\n' >"$tmp_dir/$i.status"
    fi
  ) &
done
wait

successes="$(grep -l '^success$' "$tmp_dir"/*.status | wc -l | tr -d ' ')"
failures="$(grep -l '^failure$' "$tmp_dir"/*.status | wc -l | tr -d ' ')"
if [[ "$successes" != "5" || "$failures" != "1" ]]; then
  echo "Expected exactly five accepted requests and one rejected request; got $successes accepted and $failures rejected."
  cat "$tmp_dir"/*.log
  exit 1
fi
if ! grep -q 'AI_COACH_DAILY_LIMIT' "$tmp_dir"/*.log; then
  echo "The rejected request did not return the expected limit error."
  cat "$tmp_dir"/*.log
  exit 1
fi

recent_count="$(psql "$TEST_DATABASE_URL" -tA -c "select count(*) from public.ai_coach_requests where user_id = '$user_one' and requested_at >= now() - interval '24 hours'")"
[[ "$recent_count" == "5" ]] || { echo "Expected five recent requests, found $recent_count."; exit 1; }

# A saturated user's lock and quota must not block another user's request.
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -c "set role service_role; insert into public.ai_coach_requests(id, user_id) values ('b0000000-0000-4000-8000-000000000001', '$user_two')"

echo "Atomic AI coach limit test passed: 5/6 concurrent requests accepted, the 6th rejected, stale requests ignored, and users isolated."
