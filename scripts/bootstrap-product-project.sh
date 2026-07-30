#!/usr/bin/env bash
# Stand up a fresh GCP/Firebase project for the school edition.
#
# This exists so the production setup is a script rather than a memory. It was written and proved
# against a personal Google account; when the business account exists, run the same script with a
# different project id and billing account and you get the same thing.
#
# It is idempotent — every step checks before it creates — so it is safe to re-run after a failure.
#
# Usage:
#   scripts/bootstrap-product-project.sh --project teacher-planner-prod --billing 0X0X0X-0X0X0X-0X0X0X
#   scripts/bootstrap-product-project.sh --project teacher-planner-prod --billing ... --dry-run
set -euo pipefail

export CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-/opt/homebrew/bin/python3.14}"

PROJECT=""
BILLING=""
REGION=europe-west2          # London: Firestore, Cloud Run, Storage and secrets all live here
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --billing) BILLING="$2"; shift 2 ;;
    --region)  REGION="$2";  shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ -z "$PROJECT" ]] && { echo "--project is required" >&2; exit 1; }
[[ -z "$BILLING" && $DRY_RUN -eq 0 ]] && { echo "--billing is required (list with: gcloud billing accounts list)" >&2; exit 1; }

BUCKET="${PROJECT}-resources"
SA="teacher-planner-run@${PROJECT}.iam.gserviceaccount.com"

run() {
  # Redact bearer tokens before echoing — the curl steps expand a real access token into their
  # arguments, and this output gets pasted into notes and issues.
  echo "  \$ $*" | sed -E 's/(Bearer )[A-Za-z0-9._-]+/\1<redacted>/g'
  [[ $DRY_RUN -eq 1 ]] || "$@"
}

echo "== Teacher Planner: school-edition project bootstrap =="
echo "   project=$PROJECT region=$REGION bucket=$BUCKET"
[[ $DRY_RUN -eq 1 ]] && echo "   (dry run — nothing will be created)"
echo

echo "1. Project"
if gcloud projects describe "$PROJECT" >/dev/null 2>&1; then
  echo "   already exists"
else
  run gcloud projects create "$PROJECT" --name="Teacher Planner"
  run gcloud billing projects link "$PROJECT" --billing-account="$BILLING"
fi

echo "2. APIs"
run gcloud services enable \
  run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com \
  artifactregistry.googleapis.com firestore.googleapis.com firebase.googleapis.com \
  identitytoolkit.googleapis.com firebasestorage.googleapis.com aiplatform.googleapis.com \
  cloudfunctions.googleapis.com \
  --project "$PROJECT"

echo "3. Firebase"
if [[ $DRY_RUN -eq 1 ]]; then
  echo "   (dry run — would add Firebase to the project if absent)"
elif ! curl -sf -H "Authorization: Bearer $(gcloud auth print-access-token)" \
     "https://firebase.googleapis.com/v1beta1/projects/${PROJECT}" >/dev/null 2>&1; then
  run curl -sf -X POST -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT}:addFirebase"
else
  echo "   already a Firebase project (or dry run)"
fi

echo "4. Firestore (London, in the same region as everything else)"
if gcloud firestore databases describe --project "$PROJECT" >/dev/null 2>&1; then
  echo "   already exists"
else
  run gcloud firestore databases create --location="$REGION" --project "$PROJECT"
fi

echo "5. Resources bucket (London)"
if gcloud storage buckets describe "gs://${BUCKET}" --project "$PROJECT" >/dev/null 2>&1; then
  echo "   already exists"
else
  run gcloud storage buckets create "gs://${BUCKET}" --project "$PROJECT" \
    --location="$REGION" --uniform-bucket-level-access --public-access-prevention
  # Register it with Firebase so the client SDK can use it.
  run curl -sf -X POST -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    -H "x-goog-user-project: ${PROJECT}" -H 'Content-Type: application/json' -d '{}' \
    "https://firebasestorage.googleapis.com/v1beta/projects/${PROJECT}/buckets/${BUCKET}:addFirebase"
fi

echo "6. Secrets"
# The school edition authenticates to Agent Platform with the runtime service account, so it needs
# no Gemini key — only the secret that signs sandbox callback tokens.
if gcloud secrets describe sandbox-token-secret --project "$PROJECT" >/dev/null 2>&1; then
  echo "   sandbox-token-secret already exists"
elif [[ $DRY_RUN -eq 0 ]]; then
  python3 -c "import secrets;print(secrets.token_urlsafe(48),end='')" | \
    gcloud secrets create sandbox-token-secret --replication-policy=user-managed \
      --locations="$REGION" --data-file=- --project "$PROJECT"
fi

echo "7. Runtime service account"
if gcloud iam service-accounts describe "$SA" --project "$PROJECT" >/dev/null 2>&1; then
  echo "   already exists"
else
  run gcloud iam service-accounts create teacher-planner-run \
    --display-name="Teacher Planner Cloud Run" --project "$PROJECT"
fi
run gcloud secrets add-iam-policy-binding sandbox-token-secret \
  --member="serviceAccount:${SA}" --role=roles/secretmanager.secretAccessor --project "$PROJECT"
run gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA}" --role=roles/datastore.user --condition=None
run gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${SA}" --role=roles/storage.objectAdmin --project "$PROJECT"
# Agent Platform: this is what replaces the API key.
run gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA}" --role=roles/aiplatform.user --condition=None

cat <<EOF

== Done. Remaining steps that cannot be scripted ==

  a) Firebase console -> Authentication: enable Google, Microsoft and Email/Password.
     Microsoft also needs an Azure app registration; copy the client id/secret in.

  b) Deploy rules and the app from the production branch:
       firebase deploy --only firestore:rules,storage --project ${PROJECT}
       gcloud run deploy teacher-planner --source . --project ${PROJECT} --region ${REGION} \\
         --service-account ${SA} --allow-unauthenticated --port 8080 --timeout 3600 \\
         --set-secrets SANDBOX_TOKEN_SECRET=sandbox-token-secret:latest \\
         --set-env-vars "EDITION=school,AGENT_PROVIDER=agent-platform,AGENT_PLATFORM_PROJECT=${PROJECT},RESOURCES_BUCKET=${BUCKET},FIREBASE_WEB_CONFIG=<web config JSON>,PUBLIC_BASE_URL=<the run.app URL>"

  c) Add the Cloud Run hostname to authorised domains:
       node scripts/add-authorized-domain.mjs <hostname> --project ${PROJECT}

  d) Set the bucket's CORS policy to the deployed origin (a hand-made bucket has none, and
     browser uploads fail with an opaque 400 until it does).

  e) Ask your Google account team for zero-data-retention terms, and to be told when managed
     agents accept a regional endpoint — interactions are global-only today (docs/compliance/data-map.md).
EOF
