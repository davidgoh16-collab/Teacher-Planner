# The two editions

One codebase ships two products. A fork would need every fix applied twice and would drift within
weeks, so the difference is configuration.

| | Personal | School |
|---|---|---|
| Branch | `main` | `production` |
| Who it's for | David's own planning | Schools that buy it |
| Firebase project | `school-apps-52c7d` | its own (see `scripts/bootstrap-product-project.sh`) |
| AI | Gemini API, server-held key | Gemini Enterprise Agent Platform, Cloud DPA |
| Branding | Sage, fixed | White-labelled per school |
| Orgs, invites, licensing | off | on |
| Compliance surfaces | off | on |
| Live voice | on | off for now |
| Android build | on | off |

## How the switch works

Three layers, in order of precedence:

1. **Build time** — `VITE_EDITION=school` sets the default.
2. **Runtime** — `EDITION` on the Cloud Run service, emitted by `/env.js`. The server wins, so one
   built image can be deployed as either edition.
3. **Per organisation** — the school's own branding and defaults, from their `orgs/{orgId}` document.

Flags live in one typed object in [config/edition.ts](../config/edition.ts). There is deliberately
no general feature-flag system: two products need one switch, not a framework.

`/env.js` can also supply the entire Firebase web config (`FIREBASE_WEB_CONFIG`), the resources
bucket and the custom-token function URL. That is the piece that makes a second Firebase project
possible without touching the bundle.

## Branch discipline

`production` merges **from** `main`. Features land on `main` first, behind a flag if they are
school-only, and are pulled into `production` deliberately.

The only differences allowed to live permanently on `production` are documentation and
configuration — finalised compliance documents, pilot-school samples. Anything else belongs on
`main` behind `flags`. A fix committed only to `production` is how the two versions start drifting;
fix on `main` and merge forward instead.

## Deploying the school edition

After `scripts/bootstrap-product-project.sh` has created the project:

```bash
git checkout production && git merge main
VITE_EDITION=school npm run build

gcloud run deploy teacher-planner --source . \
  --project <product-project> --region europe-west2 \
  --service-account teacher-planner-run@<product-project>.iam.gserviceaccount.com \
  --allow-unauthenticated --port 8080 --timeout 3600 \
  --set-secrets SANDBOX_TOKEN_SECRET=sandbox-token-secret:latest \
  --set-env-vars "EDITION=school,AGENT_PROVIDER=agent-platform,AGENT_PLATFORM_PROJECT=<product-project>,RESOURCES_BUCKET=<product-project>-resources,FIREBASE_WEB_CONFIG=<json>,PUBLIC_BASE_URL=<run.app url>"
```

Then add the hostname to authorised domains (`scripts/add-authorized-domain.mjs`) and set the
bucket's CORS policy — a hand-made bucket has none, and browser uploads fail with an opaque 400
until it does.

## What a school build must never contain

- David's uid as an owner or admin
- The sage palette as a selectable theme
- The personal project's Firebase config as the *resolved* config (the built-in values are a
  fallback for the personal edition; in school mode the deployment must inject its own)
- A baked Gemini API key — the school edition authenticates to Agent Platform with its runtime
  service account and has no key at all
