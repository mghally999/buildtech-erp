#!/bin/sh
# Put the current build live: the database changes first, then the invoice reader function,
# then the site, then the auth settings, then a check. Reads the tokens from .env.local in the repo root:
#   SUPABASE_ACCESS_TOKEN   (write access to the live project)
#   CLOUDFLARE_API_TOKEN    (Workers Scripts: Edit on the account that owns the Worker)
#   CLOUDFLARE_ACCOUNT_ID
#   ANTHROPIC_API_KEY       (optional: set on the invoice reader function when present)
#
#   bash tests/deploy_live.sh
#
# Each migration is one transaction and skips itself if already applied, so this can be
# run again after a failure. The site is published from site/, assembled here from the
# files in the repo root, at the Worker named in wrangler.toml.
set -eu
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
PROD=zlyqecpsgzgbpbikrlro
API="https://api.supabase.com/v1/projects/$PROD"
H1="Authorization: Bearer $SUPABASE_ACCESS_TOKEN"; H2="Content-Type: application/json"; H3="User-Agent: curl/8.7.1"

echo "== 1. migrations on the live project"
ALLOW_PRODUCTION=yes SUPABASE_PROJECT_REF=$PROD python3 tests/apply_migrations.py

echo "== 1b. the invoice reader function, with its Anthropic key when .env.local has one"
npx --yes supabase@2 functions deploy read-invoice --project-ref $PROD --use-api 2>&1 | tail -2
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  curl -s -m 30 -X POST "$API/secrets" -H "$H1" -H "$H2" -H "$H3" \
    -d "[{\"name\":\"ANTHROPIC_API_KEY\",\"value\":\"$ANTHROPIC_API_KEY\"}]" \
    -o /dev/null -w "Anthropic key set on the function: HTTP %{http_code}\n"
fi

echo "== 2. the site"
rm -rf site && mkdir -p site
cp index.html config.js sw.js _headers manifest.webmanifest logo.png logo-mark.png site/
cp -r fonts icons vendor site/
npx --yes wrangler@4 deploy 2>&1 | grep -E "Uploaded|Deployed|Version|workers.dev|rror"

echo "== 3. sign-up off, minimum password 8"
curl -s -m 30 -X PATCH "$API/config/auth" -H "$H1" -H "$H2" -H "$H3" \
  -d '{"disable_signup":true,"password_min_length":8}' \
  | python3 -c "import json,sys; c=json.load(sys.stdin); print({k:c.get(k) for k in ('disable_signup','password_min_length')})"

echo "== 4. verify"
curl -s -m 30 -X POST "$API/database/query" -H "$H1" -H "$H2" -H "$H3" \
  -d '{"query":"select (select count(*) from applied_migrations) as applied, (select max(name) from applied_migrations) as latest, (select count(*) from pg_policies where policyname like $$%_own_office$$) as office_policies","read_only":true}' \
  | python3 -c "import json,sys; r=json.load(sys.stdin)[0]; print('migrations applied:', r['applied'], '| latest:', r['latest'], '| office policies:', r['office_policies'])"
sleep 5
printf 'live site: '; curl -s -m 20 https://shiny-sound-c7b3.charleseliottbas.workers.dev/ | grep -o "BUILD_VERSION = '[^']*'"
printf 'service worker: '; curl -s -m 20 https://shiny-sound-c7b3.charleseliottbas.workers.dev/sw.js | grep -o "const VERSION = '[^']*'"
echo "== done. Next, as Charles: Settings, Who can get in: Chris owner, Belgian colleagues to Bruges; Settings, The document: the Dubai TRN."
