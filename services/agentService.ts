import { PLANNER_AGENT_TOOLS, AgentFunctionTool } from "./plannerTools";
import { authHeaders, NATIVE_GEMINI_KEY, useDirectGemini } from "./aiService";
import { maskEmailsDeep } from "../utils/pseudonymiser";

/**
 * REST client for Google's Antigravity managed agent (Gemini Interactions API).
 *
 * The Antigravity `interactions` API only exists in `@google/genai` v2.x; this app pins v1.x and
 * keeps the existing chat / native-audio assistant on it. To avoid a risky major-version SDK bump
 * we call the REST endpoint directly with `fetch`. This file is the only place that talks to the
 * Interactions API.
 *
 * Docs: https://ai.google.dev/gemini-api/docs/antigravity-agent
 */

// Same-origin server proxy. It forwards the interaction body to the Antigravity Interactions API
// with the server-held Gemini key and the required Api-Revision header, so the key never reaches
// the browser (key-exposure fix). Requests carry the user's Firebase ID token as a Bearer.
const ENDPOINT = "/api/interactions/step";
export const AGENT = "antigravity-preview-05-2026";

// Native builds have no server proxy, so they call the Antigravity Interactions API directly with
// the baked Gemini key and the required Api-Revision header (mirrors server.js).
const NATIVE_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const AGENT_API_REVISION = "2026-05-20";

/**
 * Resolve where an interactions request goes: straight to Google with the baked key on native, or
 * through the same-origin proxy (Firebase-token authorised) on web. On native the body is
 * email-masked here, matching the server-side backstop.
 */
const buildInteractionTransport = async (
  body: Record<string, any>,
  extraHeaders: Record<string, string> = {},
): Promise<{ url: string; headers: Record<string, string>; body: Record<string, any> }> => {
  if (useDirectGemini) {
    // `plannerEnv` is an instruction to OUR proxy, not a field the Interactions API knows. The
    // native path talks to Google directly, so drop it — the run still works, just without the
    // server-assembled sandbox (skills/brand/workspace files).
    const { plannerEnv, ...directBody } = body;
    return {
      url: NATIVE_INTERACTIONS_URL,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": NATIVE_GEMINI_KEY,
        "Api-Revision": AGENT_API_REVISION,
        ...extraHeaders,
      },
      body: maskEmailsDeep(directBody),
    };
  }
  return { url: ENDPOINT, headers: { ...(await authHeaders()), ...extraHeaders }, body };
};

// Agent runs are autonomous multi-step loops that can take minutes; give them a long ceiling.
const REQUEST_TIMEOUT_MS = 300_000;

/**
 * Marker appended to errors caused by a sandbox environment that no longer exists. Environments
 * are snapshotted after 15 minutes idle and deleted after a 7-day TTL, so any stored session can
 * outlive its sandbox; the API answers `404 {"error":{"code":"not_found"}}` when it does.
 * Callers use {@link isEnvironmentGoneError} to restart the run instead of surfacing a failure.
 */
const ENV_GONE_MARKER = "[environment-gone]";

/** True when an agent error means "that sandbox is gone" rather than a real failure. */
export const isEnvironmentGoneError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes(ENV_GONE_MARKER);

/** Turn a non-OK response into a readable error, surfacing the API's own message when present. */
const describeHttpError = async (response: Response): Promise<string> => {
  const raw = await response.text().catch(() => "");
  let detail = raw.slice(0, 500);
  let code = "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) detail = parsed.error.message;
    if (parsed?.error?.code) code = String(parsed.error.code);
  } catch { /* keep the raw slice */ }
  const hint =
    response.status === 429 ? " (rate limited — wait a moment and try again)" :
    response.status === 403 ? " (check that the Gemini API key is valid and has access)" : "";
  const gone = response.status === 404 && (code === "not_found" || /not.?found/i.test(detail))
    ? ` ${ENV_GONE_MARKER}` : "";
  return `Agent request failed (${response.status})${hint}: ${detail}${gone}`;
};

export type AgentTool =
  | { type: 'code_execution' }
  | { type: 'google_search' }
  | { type: 'url_context' }
  | AgentFunctionTool;

/** Default non-mutating tools every agent run gets: code execution + web access. */
export const DEFAULT_AGENT_TOOLS: AgentTool[] = [
  { type: 'code_execution' },
  { type: 'google_search' },
  { type: 'url_context' },
];

/** Build the tool set for an agent run. Planner-mutation tools are only added for admins. */
export const buildAgentTools = (includePlannerTools: boolean): AgentTool[] =>
  includePlannerTools ? [...DEFAULT_AGENT_TOOLS, ...PLANNER_AGENT_TOOLS] : [...DEFAULT_AGENT_TOOLS];

/** A single step in an interaction (function call, function result, message, etc.). */
export interface InteractionStep {
  type: string;
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: any;
  [key: string]: any;
}

/** The interaction object returned by the Interactions API (subset we rely on). */
export interface Interaction {
  id: string;
  environment_id?: string;
  status: string; // "completed" | "requires_action" | ...
  output_text?: string;
  steps?: InteractionStep[];
  [key: string]: any;
}

/** A planner function call the agent is requesting, normalised to the app's `{ id, name, args }`. */
export interface PendingFunctionCall {
  id: string;
  name: string;
  args: any;
}

/** Result of one executed function call, sent back to the agent. */
export interface AgentFunctionResult {
  name: string;
  call_id: string;
  result: any;
}

/** Model + budget for a run. `type` is required by the API; the model is locked per interaction. */
export interface AgentConfig {
  type?: 'antigravity';
  model?: string;
  max_total_tokens?: number;
}

/**
 * Server-side environment enrichment request. The client cannot build the real `environment` — it
 * carries sandbox credentials and Admin-read data (skills, brand kit, memory) — so it sends this
 * marker instead and `/api/interactions/step` expands it into the full spec and strips it.
 */
export interface PlannerEnvRequest {
  agentId?: string;
  skillIds?: string[];
  conversationId?: string;
  includeWorkspace?: boolean;
}

interface CreateInteractionArgs {
  input?: string | any[];
  environmentId?: string;
  previousInteractionId?: string;
  functionResults?: AgentFunctionResult[];
  tools?: AgentTool[];
  agentConfig?: AgentConfig;
  plannerEnv?: PlannerEnvRequest;
  background?: boolean;
}

/**
 * Pull the agent's answer out of an interaction.
 *
 * The Interactions API does NOT return a top-level `output_text` (verified against the live API);
 * the answer is carried by `model_output` steps. The streamed path accumulates text deltas itself,
 * so this is the recovery path for blocking calls and for streams that ended without text deltas.
 */
export const extractOutputText = (interaction: Interaction): string => {
  const parts: string[] = [];
  for (const step of interaction.steps || []) {
    if (step.type !== 'model_output') continue;
    const content = (step as any).content;
    if (typeof content === 'string') parts.push(content);
    else if (Array.isArray(content)) parts.push(content.map((c: any) => (typeof c === 'string' ? c : c?.text || '')).join(''));
    else if (content?.text) parts.push(content.text);
  }
  return parts.join('').trim();
};

/** Build the shared request body for both the blocking and streamed calls. */
const buildInteractionBody = (
  { input, environmentId, previousInteractionId, functionResults, tools, agentConfig, plannerEnv, background }: CreateInteractionArgs,
  extra: Record<string, any> = {},
): Record<string, any> => {
  const body: Record<string, any> = {
    agent: AGENT,
    environment: environmentId || "remote",
    ...extra,
  };
  if (previousInteractionId) body.previous_interaction_id = previousInteractionId;
  if (tools) body.tools = tools;
  if (agentConfig) body.agent_config = { type: 'antigravity', ...agentConfig };
  if (plannerEnv) body.plannerEnv = plannerEnv;
  if (background) body.background = true;

  if (functionResults && functionResults.length > 0) {
    body.input = functionResults.map(fr => ({
      type: "function_result",
      name: fr.name,
      call_id: fr.call_id,
      result: fr.result,
    }));
  } else if (input !== undefined) {
    body.input = input;
  }
  return body;
};

/**
 * Create (or continue) an agent interaction.
 *
 * - First turn: pass `input` + `tools` (and `environmentId` "remote" is the default).
 * - Continuing a turn after executing function calls: pass `previousInteractionId`, `environmentId`
 *   (the sandbox id returned earlier) and `functionResults`.
 */
export const createAgentInteraction = async (args: CreateInteractionArgs): Promise<Interaction> => {
  const body = buildInteractionBody(args);

  const transport = await buildInteractionTransport(body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(transport.url, {
      method: "POST",
      headers: transport.headers,
      body: JSON.stringify(transport.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await describeHttpError(response));
    }
    const interaction = (await response.json()) as Interaction;
    // The API carries the answer in `model_output` steps, not a top-level field.
    if (!interaction.output_text) interaction.output_text = extractOutputText(interaction);
    return interaction;
  } finally {
    clearTimeout(timeout);
  }
};

/** A single human-facing activity item shown live while the agent works. */
export interface AgentActivityItem {
  kind: 'thinking' | 'code' | 'search' | 'tool' | 'status';
  label: string;
  detail?: string;
}

/** Callbacks invoked as streamed SSE events arrive, to drive the live "thought process" UI. */
export interface AgentStreamCallbacks {
  onMeta?: (id: string, environmentId: string) => void;
  onReasoning?: (textChunk: string) => void;
  onActivity?: (item: AgentActivityItem) => void;
  onAnswer?: (textChunk: string) => void;
}

/** Pull plain text out of a streamed Content object (defensive about shape). */
const extractText = (content: any): string => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (typeof content.text === 'string') return content.text;
  if (Array.isArray(content.parts)) {
    return content.parts.map((p: any) => (typeof p === 'string' ? p : p?.text || '')).join('');
  }
  if (Array.isArray(content)) {
    return content.map((p: any) => (typeof p === 'string' ? p : p?.text || '')).join('');
  }
  return '';
};

/** Map a starting step to a live activity item, or null if it carries no user-facing signal. */
const stepToActivity = (step: any): AgentActivityItem | null => {
  switch (step?.type) {
    case 'thought':
      return { kind: 'thinking', label: 'Thinking' };
    case 'code_execution_call':
      return { kind: 'code', label: 'Running code' };
    case 'code_execution_result':
      return { kind: 'code', label: 'Got code result' };
    case 'function_call':
      return { kind: 'tool', label: `Calling ${step.name || 'a tool'}` };
    case 'web_search':
    case 'google_search':
    case 'url_context':
      return { kind: 'search', label: 'Searching the web' };
    default:
      return null;
  }
};

/**
 * Stream an agent interaction over SSE, invoking callbacks as reasoning/activity/answer arrive.
 * Returns a fully-assembled {@link Interaction} (same shape as the blocking call) so the existing
 * function-call confirmation flow keeps working unchanged.
 */
export const streamAgentInteraction = async (
  args: CreateInteractionArgs,
  callbacks: AgentStreamCallbacks = {},
): Promise<Interaction> => {
  const { environmentId } = args;
  const body = buildInteractionBody(args, { stream: true });

  const transport = await buildInteractionTransport(body, { Accept: "text/event-stream" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Assembled interaction we return once the stream ends.
  const result: Interaction = { id: '', status: 'in_progress', output_text: '', steps: [] };

  try {
    const response = await fetch(transport.url, {
      method: "POST",
      headers: transport.headers,
      body: JSON.stringify(transport.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await describeHttpError(response));
    }
    if (!response.body) {
      throw new Error("Agent stream returned no body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const handleEvent = (raw: string) => {
      // An SSE frame may contain multiple `data:` lines; concatenate them.
      const dataLines = raw
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim());
      if (dataLines.length === 0) return;
      const payload = dataLines.join('\n');
      if (!payload || payload === '[DONE]') return;

      let evt: any;
      try { evt = JSON.parse(payload); } catch { return; }

      switch (evt.event_type) {
        case 'interaction.created': {
          const it = evt.interaction || evt;
          if (it?.id) result.id = it.id;
          if (it?.environment_id) result.environment_id = it.environment_id;
          if (result.id) callbacks.onMeta?.(result.id, result.environment_id || environmentId || 'remote');
          break;
        }
        case 'step.start': {
          if (evt.step) (result.steps as InteractionStep[]).push(evt.step as InteractionStep);
          const activity = stepToActivity(evt.step);
          if (activity) callbacks.onActivity?.(activity);
          break;
        }
        case 'step.delta': {
          const delta = evt.delta;
          if (!delta) break;
          if (delta.type === 'thought_summary') {
            const txt = extractText(delta.content);
            if (txt) callbacks.onReasoning?.(txt);
          } else if (delta.type === 'text') {
            if (delta.text) {
              result.output_text = (result.output_text || '') + delta.text;
              callbacks.onAnswer?.(delta.text);
            }
          }
          break;
        }
        case 'interaction.status_update': {
          if (evt.status) result.status = evt.status;
          break;
        }
        case 'interaction.completed': {
          const it = evt.interaction || {};
          if (it.id) result.id = it.id;
          if (it.environment_id) result.environment_id = it.environment_id;
          if (it.status) result.status = it.status;
          // The completed payload is partial; only adopt its output_text if it's at least as
          // complete as what we accumulated from text deltas (never clobber a fuller answer).
          if (typeof it.output_text === 'string' && it.output_text.length >= (result.output_text || '').length) {
            result.output_text = it.output_text;
          }
          if (Array.isArray(it.steps) && it.steps.length) result.steps = it.steps;
          break;
        }
        case 'error': {
          throw new Error(`Agent stream error: ${JSON.stringify(evt.error || evt).slice(0, 300)}`);
        }
      }
    };

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      // SSE frames are separated by a blank line.
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        handleEvent(frame);
      }
    }
    if (buffer.trim()) handleEvent(buffer);

    if (result.status === 'in_progress') result.status = 'completed';
    // A run can finish without emitting text deltas (e.g. the answer only lands in the completed
    // payload's steps). Recover it from `model_output` rather than reporting an empty answer.
    if (!result.output_text) result.output_text = extractOutputText(result);
    return result;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Return the function calls the agent is still waiting on — `function_call` steps with no matching
 * `function_result`. Filesystem/built-in tools also surface as function_calls but are executed by
 * the sandbox and already carry a result, so they are excluded. Arguments are JSON-parsed.
 */
export const getPendingFunctionCalls = (interaction: Interaction): PendingFunctionCall[] => {
  const steps = interaction.steps || [];
  const resolved = new Set(
    steps.filter(s => s.type === "function_result" && s.call_id).map(s => s.call_id as string)
  );
  return steps
    .filter(s => s.type === "function_call" && s.id && !resolved.has(s.id))
    .map(s => {
      let args = s.arguments;
      if (typeof args === "string") {
        try { args = JSON.parse(args); } catch { /* leave as-is */ }
      }
      return { id: s.id as string, name: s.name as string, args: args ?? {} };
    });
};
