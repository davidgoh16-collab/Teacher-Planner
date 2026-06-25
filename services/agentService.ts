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
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Agent request failed (${response.status}): ${errText.slice(0, 500)}`);
    }
    return (await response.json()) as Interaction;
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
