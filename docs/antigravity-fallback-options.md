# Antigravity access is blocked — fallback options

Since 2026-07-31, every project on this Google account gets `permission_denied`
calling the `antigravity-preview-05-2026` agent, regardless of project, billing
tier, or key. Root cause (see forum threads below): an account-level ToS
restriction, most likely applied alongside the closure of
`gen-lang-client-0756621599` for hosting content flagged as phishing (a private
Firebase-hosted app, misclassified — the sign-in page never collected
credentials). Manual review requested via the Antigravity category on the
Google AI Developers Forum: https://discuss.ai.google.dev/c/antigravity/64

Everything else on the account is unaffected — `generateContent`, the Deep
Research agent, and the general Interactions API (models + function calling +
built-in code execution) all work normally on the current key
(`school-apps-52c7d`, postpay). This document records what to do if the appeal
doesn't resolve.

## Option A — rebuild agent mode on plain Interactions API (validated, ready)

Confirmed working live on 2026-07-31/08-01 against the current key:

- A standard model (`gemini-3.5-flash`) via `/v1beta/interactions` with
  `tools: [{type: 'function', ...}]` — full multi-turn function-calling,
  identical shape to what Teacher Planner already drives for planner tools.
- The built-in `{type: 'code_execution'}` tool: real Python sandbox,
  `python-docx` preinstalled, ran `pip install` successfully.
- **No network access in that sandbox** (`urllib.request` → `Temporary
  failure in name resolution`) — it cannot curl a finished file back to our
  server the way Antigravity's environment does.
- Workaround, validated: have the code base64-encode the finished file and
  print it; the server decodes it out of the interaction response. Round-
  tripped a real 36,618-byte `.docx` byte-for-byte intact, no truncation.

What this means for a rebuild, concretely:
- **File output**: swap the sandbox's `curl -X POST .../artifacts` for
  "server decodes base64 out of the response." Works, but watch output-token
  limits on genuinely large documents (booklets with embedded images) —
  hasn't been tested at that size yet.
- **Skills**: no persistent mounted workspace exists for a plain model. A
  skill's `SKILL.md` + references would have to be inlined into the prompt
  every turn instead of read from `.agents/skills/...` on demand. Fine for
  small skills; the exclusion-booklet skill's `scripts/engine.py` alone is
  32KB and would cost real context budget on every single turn with no
  caching benefit.
- **No outbound network from the sandbox at all** — anything a skill
  currently fetches mid-run (a logo, a template) has to be handed to the
  model as input up front instead.
- **Open question, untested**: whether `code_execution` retains filesystem
  state across turns via `previous_interaction_id`, or whether every call
  starts from a clean container. Needs checking before relying on multi-step
  builds spanning several turns.

This is a genuine re-architecture of `server/lib/environment.mjs` and the
agent-turn orchestration, not a config flip — but everything it depends on is
already unblocked today, no waiting on Google.

## Option B — OpenAI Agents SDK + a sandbox provider (documented, not evaluated)

Researched 2026-08-01, not prototyped. Architecturally closer to Antigravity
than Option A — a real persistent container (files, shell, package installs,
possibly real network access), rather than Google's locked-down
`code_execution` tool.

Reasons this is a fallback-of-last-resort, not a near-term plan:
- **Beta**: OpenAI's own docs — "API details, defaults, and supported
  capabilities may change."
- **Not self-contained**: the SDK only orchestrates. The actual sandbox comes
  from a separate third-party provider you pick and pay for separately (E2B,
  Modal, Daytona, Cloudflare, Docker, Vercel, Runloop, Blaxel, or
  Unix-local). Whether it has real outbound network access — the one thing
  Option A is missing — depends entirely on which provider is chosen, and
  wasn't verified against any specific one.
- **New provider, new adapter**: `server/lib/agentProvider.mjs` currently
  switches between two Google backends with a deliberately verified
  compatible envelope (fixture-tested before trusting it). OpenAI's
  request/response shape, tool-calling format, and session model are all
  different — this is a new adapter, not an env var.
- **Compliance re-review needed**: this app processes pupil data (always
  pseudonymised before it leaves the browser). Moving any processing to
  OpenAI, and separately to whichever sandbox provider is chosen, means
  redoing the data-processing/residency review for two new vendors instead
  of extending the existing Google Cloud one.

If this ever becomes live: pick one sandbox provider (E2B is the most
commonly recommended starting point), spike its actual network/file
behaviour and data-residency posture directly, get real pricing, before
committing any Teacher Planner code to it.

## Option C — Claude (Anthropic) code execution + Agent Skills (researched, planned, not started)

Researched 2026-07-31, architecture planned in detail but no code written. Full plan saved at
`~/.claude/plans/shimmying-wibbling-pelican.md` — the summary below is enough to decide whether
to pick this up; the plan file has the file-by-file breakdown when it's time to build.

Beats Gemini's Interactions API on nearly every pain point in Option A, verified directly against
Anthropic's docs:

- GA, no beta header needed for code execution itself (skills and Files API do need beta headers).
- 30-day container TTL (vs. Google's 7).
- **python-docx, python-pptx, openpyxl, reportlab, pypdf, etc. are pre-installed** — the whole
  "pip install at the start of every run" step this doc's Option A had to work around disappears
  entirely.
- Anthropic's own pre-built Agent Skills (`pptx`/`xlsx`/`docx`/`pdf`) can replace bespoke
  skill-writing for common document types.
- Top-level `container` object with a real id to reuse; response blocks are typed and structured
  (no `output_text` archaeology).

The trade-off: **Claude's sandbox has zero network access** (stricter than Gemini's allowlisted
one — no pypi, no fetching a logo mid-run) and no runtime package installs at all. And the
Messages API is stateless (full history resent every call) vs. the Interactions API's stateful
`previous_interaction_id`, so "continue this turn" needs a small piece of new server-side
bookkeeping Gemini gave us for free.

What a rebuild would concretely involve (detail in the plan file):

- A new `server/lib/claudeProvider.mjs` as a third branch in `server/lib/agentProvider.mjs`'s
  existing provider seam, translating Claude's wire format into the exact `Interaction`/step/SSE
  vocabulary the client already speaks — so `agentService.ts`, `agentOrchestrator.ts`,
  `ChatPanel.tsx` and `App.tsx` need **no changes**, same design principle as the existing
  `gemini-api`/`agent-platform` seam.
- A Firestore-backed session store standing in for the stateful `previous_interaction_id` Google
  gives for free — a fresh run gets a Firestore doc holding the running Claude `messages` array +
  container id, returned to the client as an opaque id it already knows how to echo back and treat
  as "gone → restart" on 404 (the exact same recovery path the 7-day Gemini sandbox expiry already
  exercises, so no new client-side logic).
- Skills sync to the Skills API (`POST /v1/skills`, max 8 per request) instead of inlining
  `SKILL.md` text; brand kit/pinned resources uploaded up front via the Files API
  (`container_upload` blocks) since there's no mid-run fetch-on-demand without network access.
- Generated files arrive with a downloadable `file_id` in the same response — the curl-upload-with-
  injected-token dance (`sandboxToken.mjs`) this doc's Option A still needs is not needed for
  Claude at all.
- Cost gotcha worth building around deliberately: code execution bills a 5-minute-per-container
  minimum *unless* a web-search/web-fetch tool is in the same request, in which case it's free.
  Every run should always include Claude's web-search + web-fetch tools alongside code execution —
  which also directly replaces Gemini's always-on `google_search`/`url_context`, so nothing changes
  behaviourally for the teacher.
- Deferred out of an initial build: the scheduled-triggers/cron feature (no Claude equivalent to
  Google's Triggers API — would need our own Cloud Scheduler job), and the native-app
  direct-to-provider bypass (`useDirectGemini` in `aiService.ts`) — native builds would just always
  go through the server proxy under this provider.
- Reversible via env var, same as the existing two-provider seam: `AGENT_PROVIDER=claude`,
  existing `gemini-api`/`agent-platform` paths untouched.

If this is picked up: do the single cheap round-trip test first (ask Claude's code execution tool
to build a real `.docx` and confirm a byte-identical downloadable `file_id` comes back) before
building anything else — it's the load-bearing assumption the rest of the plan depends on.

## Sources
- https://ai.google.dev/gemini-api/docs/antigravity-agent
- https://discuss.ai.google.dev/t/antigravity-gemini-code-assist-disabled-403-tos-violation-manual-review-request/176476
- https://discuss.ai.google.dev/t/appeal-antigravity-gemini-access-disabled-403-tos-violation/172323
- https://discuss.ai.google.dev/c/antigravity/64
- https://developers.openai.com/api/docs/guides/agents/sandboxes
- https://developers.openai.com/api/docs/guides/agents/running-agents
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://platform.claude.com/docs/en/build-with-claude/files
- https://platform.claude.com/docs/en/build-with-claude/skills-guide
