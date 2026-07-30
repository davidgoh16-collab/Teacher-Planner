import {
  createAgentInteraction,
  streamAgentInteraction,
  isEnvironmentGoneError,
  AgentStreamCallbacks,
  AgentTool,
  AgentConfig,
  PlannerEnvRequest,
  Interaction,
} from './agentService';

/**
 * Runs one agent turn, owning the three failure modes the UI shouldn't have to think about:
 * streaming falling back to a blocking call, an expired sandbox, and reporting which of those
 * happened so the caller can tell the user.
 */

export interface AgentTurnArgs {
  input: string | any[];
  /** Sandbox + interaction to continue. Omit to start a fresh run. */
  session?: { interactionId: string; environmentId: string } | null;
  tools?: AgentTool[];
  agentConfig?: AgentConfig;
  plannerEnv?: PlannerEnvRequest;
  /**
   * Rebuilds the input for a restarted run. A continuation prompt assumes the sandbox already
   * holds the conversation's context; when the sandbox is gone that context went with it, so the
   * caller must supply the full standalone prompt instead.
   */
  buildFreshInput?: () => string | any[];
}

export interface AgentTurnResult {
  interaction: Interaction;
  /** True when the run was restarted because its sandbox had expired. */
  restarted: boolean;
  /** True when SSE failed and the blocking call answered instead (no live thought process). */
  streamFellBack: boolean;
}

/** One attempt: stream if possible, else fall back to the blocking call. */
const attempt = async (
  args: { input: string | any[]; session?: { interactionId: string; environmentId: string } | null; tools?: AgentTool[]; agentConfig?: AgentConfig; plannerEnv?: PlannerEnvRequest },
  callbacks: AgentStreamCallbacks,
): Promise<{ interaction: Interaction; streamFellBack: boolean }> => {
  const requestArgs = {
    input: args.input,
    environmentId: args.session?.environmentId,
    previousInteractionId: args.session?.interactionId,
    tools: args.tools,
    agentConfig: args.agentConfig,
    plannerEnv: args.plannerEnv,
  };

  try {
    return { interaction: await streamAgentInteraction(requestArgs, callbacks), streamFellBack: false };
  } catch (streamErr) {
    // An expired sandbox must reach the caller so the run can be restarted — retrying it as a
    // blocking call would just 404 again.
    if (isEnvironmentGoneError(streamErr)) throw streamErr;
    console.warn('Agent stream failed, falling back to blocking call:', streamErr);
    return { interaction: await createAgentInteraction(requestArgs), streamFellBack: true };
  }
};

/**
 * Run an agent turn. If the stored sandbox has expired (sandboxes are deleted after a 7-day TTL,
 * so any resumed conversation can outlive its environment), the turn is transparently restarted in
 * a fresh sandbox rather than surfacing a 404.
 */
export const runAgentTurn = async (
  { input, session, tools, agentConfig, plannerEnv, buildFreshInput }: AgentTurnArgs,
  callbacks: AgentStreamCallbacks = {},
): Promise<AgentTurnResult> => {
  try {
    const { interaction, streamFellBack } = await attempt({ input, session, tools, agentConfig, plannerEnv }, callbacks);
    return { interaction, restarted: false, streamFellBack };
  } catch (err) {
    if (!session || !isEnvironmentGoneError(err)) throw err;
    const { interaction, streamFellBack } = await attempt(
      { input: buildFreshInput ? buildFreshInput() : input, session: null, tools, agentConfig, plannerEnv },
      callbacks,
    );
    return { interaction, restarted: true, streamFellBack };
  }
};

/**
 * Continue a turn by returning executed function results to the agent. Same expired-sandbox
 * caveat, but there is nothing to restart here: the results belong to an interaction that no
 * longer exists, so the caller is told to start a new turn instead.
 */
export const continueAgentTurn = async (
  session: { interactionId: string; environmentId: string },
  functionResults: Array<{ name: string; call_id: string; result: any }>,
  opts: { tools?: AgentTool[]; agentConfig?: AgentConfig } = {},
): Promise<{ interaction: Interaction | null; environmentGone: boolean }> => {
  try {
    const interaction = await createAgentInteraction({
      environmentId: session.environmentId,
      previousInteractionId: session.interactionId,
      functionResults,
      tools: opts.tools,
      agentConfig: opts.agentConfig,
    });
    return { interaction, environmentGone: false };
  } catch (err) {
    if (isEnvironmentGoneError(err)) return { interaction: null, environmentGone: true };
    throw err;
  }
};
