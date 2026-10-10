#!/usr/bin/env bash
# Build the Lambda bundles and deploy the SAM stack. Keys come from api/.env as NoEcho parameters and are
# masked in the output. Usage: scripts/deploy.sh [WebOrigin] [WebUrl]
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f api/.env ] && . api/.env; set +a
WEB_ORIGIN_PARAM="${1:-${DEPLOY_WEB_ORIGIN:-http://127.0.0.1:3000}}"
WEB_URL_PARAM="${2:-${DEPLOY_WEB_URL:-http://localhost:3000}}"

npx tsx scripts/build-lambdas.ts

mask() {
  python3 -c '
import os, sys
secrets = [v for k in ("OPENAQ_API_KEY","DATA_GOV_API_KEY","FIRMS_MAP_KEY","GOOGLE_API_KEY") if (v := os.environ.get(k))]
for line in sys.stdin:
    for s in secrets: line = line.replace(s, "*****")
    sys.stdout.write(line); sys.stdout.flush()'
}

# sam rejects empty values (KEY=), so pass only the parameters that are set; the rest keep their template defaults
params=()
add() { [ -n "$2" ] && params+=("$1=$2") || true; }
add OpenaqApiKey "${OPENAQ_API_KEY:-}"
add DataGovApiKey "${DATA_GOV_API_KEY:-}"
add FirmsMapKey "${FIRMS_MAP_KEY:-}"
add GoogleApiKey "${GOOGLE_API_KEY:-}"
add ReadingsSource "${READINGS_SOURCE:-openaq}"
add ModelProvider "${MODEL_PROVIDER:-google}"
add ModelId "${MODEL_ID:-}"
add WebOrigin "${WEB_ORIGIN_PARAM}"
add WebUrl "${WEB_URL_PARAM}"

cd infra
sam deploy \
  --stack-name wajah \
  --region ap-south-1 \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides "${params[@]}" 2>&1 | mask
