import { PLANNER_AGENT_TOOLS, AgentFunctionTool } from "./plannerTools";

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

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
export const AGENT = "antigravity-preview-05-2026";

// The Interactions API requires an Api-Revision header on REST calls (the v2 SDK sends it
// automatically as GOOGLE_GENAI_API_REVISION); requests without it are rejected/mis-routed.
const API_REVISION = "2026-05-20";

// Agent runs are autonomous multi-step loops that can take minutes; give them a long ceiling.
const REQUEST_TIMEOUT_MS = 300_000;

/** Resolve the Gemini API key using the same 4-layer fallback as aiService.ts / App.tsx. */
const getApiKey = (): string => {
  const apiKey =
    window.ENV?.GEMINI_API_KEY ||
    import.meta.env.GEMINI_API_KEY ||
    window.ENV?.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API key must be set when using the Gemini API.");
  }
  return apiKey;
};

/** Turn a non-OK response into a readable error, surfacing the API's own message when present. */
const describeHttpError = async (response: Response): Promise<string> => {
  const raw = await response.text().catch(() => "");
  let detail = raw.slice(0, 500);
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) detail = parsed.error.message;
  } catch { /* keep the raw slice */ }
  const hint =
    response.status === 429 ? " (rate limited — wait a moment and try again)" :
    response.status === 403 ? " (check that the Gemini API key is valid and has access)" : "";
  return `Agent request failed (${response.status})${hint}: ${detail}`;
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

interface CreateInteractionArgs {
  input?: string | any[];
  environmentId?: string;
  previousInteractionId?: string;
  functionResults?: AgentFunctionResult[];
  tools?: AgentTool[];
}

/**
 * Create (or continue) an agent interaction.
 *
 * - First turn: pass `input` + `tools` (and `environmentId` "remote" is the default).
 * - Continuing a turn after executing function calls: pass `previousInteractionId`, `environmentId`
 *   (the sandbox id returned earlier) and `functionResults`.
 */
export const createAgentInteraction = async ({
  input,
  environmentId,
  previousInteractionId,
  functionResults,
  tools,
}: CreateInteractionArgs): Promise<Interaction> => {
  const apiKey = getApiKey();

  const body: Record<string, any> = {
    agent: AGENT,
    environment: environmentId || "remote",
  };
  if (previousInteractionId) body.previous_interaction_id = previousInteractionId;
  if (tools) body.tools = tools;

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Revision": API_REVISION,
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await describeHttpError(response));
    }
    return (await response.json()) as Interaction;
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
  { input, environmentId, previousInteractionId, functionResults, tools }: CreateInteractionArgs,
  callbacks: AgentStreamCallbacks = {},
): Promise<Interaction> => {
  const apiKey = getApiKey();

  const body: Record<string, any> = {
    agent: AGENT,
    environment: environmentId || "remote",
    stream: true,
  };
  if (previousInteractionId) body.previous_interaction_id = previousInteractionId;
  if (tools) body.tools = tools;
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Assembled interaction we return once the stream ends.
  const result: Interaction = { id: '', status: 'in_progress', output_text: '', steps: [] };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "Api-Revision": API_REVISION,
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
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
