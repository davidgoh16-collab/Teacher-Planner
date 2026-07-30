# Deploying Teacher Planner

Two editions ship from this repo. This document covers the **personal** edition (David's own
planner, `main`). The school edition runs the same image with different configuration in its own
GCP project — see [editions.md](./editions.md) once that lands.

| | Personal edition |
|---|---|
| GCP / Firebase project | `school-apps-52c7d` (project number `982739442942`) |
| Cloud Run service | `teacher-planner`, region `europe-west2` (London) |
| URL | https://teacher-planner-982739442942.europe-west2.run.app |
| Firestore | `(default)`, `europe-west2` |
| AI | Gemini API key, held server-side only |

Everything is in the UK: Firestore, Cloud Run, and the Secret Manager replica are all
`europe-west2`.

## Routine redeploy

```bash
scripts/deploy-personal.sh          # code change only
scripts/deploy-personal.sh --full   # also reapply env vars, secrets and scaling
```

The script verifies `/health` and then greps every served JS bundle for the Gemini key, failing the
deploy if it appears. Do not remove that check — see "Why .gcloudignore matters" below.

## Environment

| Variable | Source | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Secret Manager `gemini-api-key` | Server-side only. Never reaches the browser. |
| `SANDBOX_TOKEN_SECRET` | Secret Manager `sandbox-token-secret` | Signs the short-lived tokens the agent sandbox uses to upload artifacts back to us. |
| `VITE_FIREBASE_API_KEY` | env var | Public client identifier, served to the browser by `/env.js`. Not a secret; access control is in `firestore.rules`. |
| `EDITION` | env var | `personal`. Read by `/env.js` and the edition config layer. |
| `AGENT_PROVIDER` | env var | `gemini-api` or `agent-platform`. |

Both secrets use user-managed replication pinned to `europe-west2`, and the runtime service account
`teacher-planner-run@` holds only `secretmanager.secretAccessor` on them. Token verification needs
no IAM role at all — `verifyIdToken` checks Google's public keys against the project id.

## Why `.gcloudignore` matters

`.env.local` contains `VITE_GEMINI_API_KEY`. It exists for the **native Android build**, which has
no server to proxy through and therefore bakes the key into the APK. If that file reaches the Cloud
Build context, `vite build` inlines the key into the **web** bundle and it ships to every browser.
`.gcloudignore` excludes it, and the deploy script proves the exclusion held.

`.gcloudignore` also keeps `node_modules` (830 MB) and `android/` out of the upload.

## First-time setup (already done; recorded so it can be replayed)

```bash
export CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.14
gcloud config set project school-apps-52c7d
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  secretmanager.googleapis.com artifactregistry.googleapis.com

printf '%s' "$GEMINI_KEY" | gcloud secrets create gemini-api-key \
  --replication-policy=user-managed --locations=europe-west2 --data-file=-
python3 -c "import secrets;print(secrets.token_urlsafe(48),end='')" | \
  gcloud secrets create sandbox-token-secret \
  --replication-policy=user-managed --locations=europe-west2 --data-file=-

gcloud iam service-accounts create teacher-planner-run \
  --display-name="Teacher Planner Cloud Run"
for S in gemini-api-key sandbox-token-secret; do
  gcloud secrets add-iam-policy-binding $S \
    --member="serviceAccount:teacher-planner-run@school-apps-52c7d.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor
done
```

## Authorised domains — read this before touching them

Firebase sign-in only works from a domain on the project's authorised list, so a new Cloud Run
hostname has to be added. **The Identity Toolkit config PATCH replaces the entire
`authorizedDomains` array.** Sending just the new domain deletes all the others — and this project
is shared with roughly a dozen other live apps, so that outage would be project-wide.

Use the guarded script, which reads the current list, appends, writes the merged list in the same
process, and then re-reads to prove nothing was lost:

```bash
node scripts/add-authorized-domain.mjs <hostname> --dry-run   # inspect first
node scripts/add-authorized-domain.mjs <hostname>
```

It refuses to write if the read returns fewer than three domains, on the assumption that a short
read means a failed read rather than a genuinely tiny list.

Also note Cloud Run answers on two hostnames. Only the **project-number** form
(`teacher-planner-982739442942.europe-west2.run.app`) is registered. Sign-in fails with
`auth/unauthorized-domain` on the other one, so don't "tidy" the URL anywhere it appears — the
Electron wrapper in particular depends on it.

## Local development

```bash
npm run dev     # Vite on :3000, proxies /api to :8080
npm start       # the Express server on :8080 — needed for any AI feature
```

Without `npm start` running alongside, `/api` 404s and every AI feature fails: the dev server only
serves the front end.

## Gotchas on this machine

- `gcloud` fails under the default Python. Always `export CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.14`.
- `npm run rules:test` needs Java, which isn't on `PATH`. Use Android Studio's bundled runtime:
  `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"; export PATH="$JAVA_HOME/bin:$PATH"`.
- The PWA service worker caches the app shell. After deploying, a browser can keep serving the old
  bundle for a load or two; unregister the service worker when verifying a change immediately.
