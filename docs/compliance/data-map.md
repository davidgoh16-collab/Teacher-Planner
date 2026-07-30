# Where Teacher Planner's data lives

Written for two audiences: us, when deciding whether a change is safe, and a school's data
protection officer, who will ask most of these questions before signing anything.

Everything below is verified against the running system, not inferred from documentation.

## Summary

| | Personal edition | School edition |
|---|---|---|
| Web app | Cloud Run, `europe-west2` (London) | Cloud Run, `europe-west2` |
| Database | Firestore, `europe-west2` | Firestore, `europe-west2` |
| Files | Cloud Storage, `europe-west2` | Cloud Storage, `europe-west2` |
| Secrets | Secret Manager, replica pinned `europe-west2` | same |
| AI | Gemini API (paid tier), server-held key | Gemini Enterprise Agent Platform, own GCP project |
| AI terms | Standard API terms; not used for training | Cloud Data Processing Addendum; not used for training; zero-retention available on request |

## The honest position on AI residency

**Everything except the AI inference is in the UK.** That part is solid and verified: the Cloud Run
service, the Firestore database, the Storage bucket and both Secret Manager replicas are all
`europe-west2`.

**Managed agent inference is not yet regional.** Interactions with managed agents on Agent Platform
are only accepted at the `global` location today — a request to a regional endpoint is refused.
This matters and should not be glossed over in a sales conversation:

- What the school edition *does* get by moving to Agent Platform: the Cloud Data Processing
  Addendum, Google's commitment not to train on customer data, enterprise support, and
  zero-data-retention terms on request. These are contractual protections the consumer API doesn't
  carry, and they are the substantive part of a processor relationship.
- What it does *not* yet get: a guarantee that inference happens on UK or EU infrastructure.
  Transfers are covered by Google's Data Privacy Framework certification (including the UK
  Extension) and by the Cloud DPA's Standard Contractual Clauses with the UK International Data
  Transfer Addendum — so there is a lawful transfer mechanism — but that is a legal basis, not data
  residency.
- Separately, `europe-west2` *is* available for at-rest residency and in-region ML processing for
  some Gemini Enterprise products, on an allowlist basis via a Google account team. That is worth
  requesting, but it does not currently cover managed-agent interactions.

`AGENT_PLATFORM_LOCATION` exists so this becomes a configuration change rather than a code change
the day regional endpoints appear. **Do not set it to `eu` casually:** the EU multi-region
explicitly excludes the United Kingdom, so choosing it would be a decision to process UK schools'
data in the EU and belongs in a DPIA, not in a deployment script.

The mitigation that does the heavy lifting today is that **identifying data should never reach the
model at all** — see below.

## What actually reaches the AI

Names are replaced before anything leaves the browser. `utils/pseudonymiser.ts` rewrites pupil and
staff names to tokens like `Student_3F2A19B4`, and `server.js` masks email addresses again on the
way out as a backstop. The mapping is derived from the teacher's own data and never leaves their
device.

The consequence runs all the way through: the agent sandbox only ever sees tokens, so every
document it produces contains tokens, so those documents are stored pseudonymised and the real
names are put back on the teacher's device at download time (`utils/documentRehydrator.ts`).

This is why the residency gap above is bounded rather than open-ended: what crosses a border is
lesson content with placeholder names, not a class list.

## Data categories

| Category | Where | Retention |
|---|---|---|
| Teacher account (email, display name, auth provider) | Firebase Auth | Until account deletion |
| Planner content (lessons, tasks, projects, key dates, timetables) | Firestore, per user | Until deleted by the user |
| Colleague/student names entered for timetabling | Firestore, per user | Until deleted by the user |
| AI conversations | Firestore, per user | Until deleted; org retention setting applies in the school edition |
| Generated and uploaded files | Cloud Storage, per user | Until deleted; org retention setting applies |
| Agent sandbox contents | Google-managed, ephemeral | Snapshot after 15 min idle, deleted after 7 days |
| Sandbox callback tokens | Not stored; signed and verified | 24 h (interactive), 90 days (scheduled runs) |

## Sub-processors

- **Google Cloud Platform** — Cloud Run, Firestore, Cloud Storage, Secret Manager, all `europe-west2`.
- **Google (Gemini API / Gemini Enterprise Agent Platform)** — model inference and the agent
  sandbox. Personal edition uses the consumer API; the school edition uses Agent Platform under its
  own GCP project and the Cloud DPA.

No other processor receives personal data. MCP connections are opt-in per user and per school, and
any server connected that way becomes a sub-processor the school has chosen — that needs saying
plainly in the school's own records when they enable one.

## Deletion

- A teacher can delete any conversation or file from the app; both the index entry and the stored
  object go.
- Account deletion removes the Firebase Auth record and the `users/{uid}` subtree.
- Sandbox contents expire on Google's 7-day TTL and are not under our control; nothing durable is
  kept there by design, which is why every artifact is copied back to our own storage.

## Open items

- Ask the Google account team for zero-data-retention terms on the product project.
- Ask to be notified when managed agents accept a regional endpoint; revisit this document then.
- Server-side retention sweep (currently retention is enforced when the app is opened).
