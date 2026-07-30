#!/usr/bin/env bash
# Deploy the personal edition to Cloud Run (europe-west2, UK).
#
# Prerequisites are created once by scripts/bootstrap-project.sh. This script is the routine
# redeploy: build from source with the existing Dockerfile and roll a new revision.
#
# Usage: scripts/deploy-personal.sh [--full]
#   (no args)  fast redeploy — reuses the service's existing env vars and secrets
#   --full     also (re)apply env vars, secrets, and scaling settings
set -euo pipefail

# gcloud is broken under this machine's default Python (importlib.metadata on 3.9).
export CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-/opt/homebrew/bin/python3.14}"

PROJECT=school-apps-52c7d
REGION=europe-west2
SERVICE=teacher-planner
SA="teacher-planner-run@${PROJECT}.iam.gserviceaccount.com"

cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--full" ]]; then
  # The Firebase web API key is a public client identifier, not a secret; it is served to the
  # browser by /env.js. The Gemini key is a real secret and only ever lives server-side.
  FBKEY="$(grep '^VITE_FIREBASE_API_KEY=' .env.local | cut -d= -f2)"
  gcloud run deploy "$SERVICE" --source . --project "$PROJECT" --region "$REGION" \
    --service-account "$SA" \
    --allow-unauthenticated --port 8080 \
    --set-secrets GEMINI_API_KEY=gemini-api-key:latest,SANDBOX_TOKEN_SECRET=sandbox-token-secret:latest \
    --set-env-vars "VITE_FIREBASE_API_KEY=${FBKEY},EDITION=personal,AGENT_PROVIDER=gemini-api" \
    --memory 1Gi --cpu 1 --min-instances 0 --max-instances 1 \
    --timeout 3600 --concurrency 40 \
    --quiet
else
  gcloud run deploy "$SERVICE" --source . --project "$PROJECT" --region "$REGION" --quiet
fi

URL="https://teacher-planner-982739442942.europe-west2.run.app"
echo
echo "Health: $(curl -s "$URL/health")"

# The build must never ship the Gemini key to the browser. .gcloudignore keeps .env.local out of
# the build context; this proves it worked rather than assuming it did.
GEM="$(grep '^VITE_GEMINI_API_KEY=' .env.local | cut -d= -f2 || true)"
if [[ -n "$GEM" ]]; then
  leaked=0
  for a in $(curl -s "$URL/" | grep -oE '/assets/[A-Za-z0-9_.-]+\.js' | sort -u); do
    if curl -s "$URL$a" | grep -qF "$GEM"; then echo "LEAK: Gemini key found in $a"; leaked=1; fi
  done
  [[ $leaked -eq 0 ]] && echo "Key check: Gemini key absent from served bundles."
  [[ $leaked -eq 1 ]] && exit 1
fi
echo "Deployed: $URL"
