import { authHeaders } from './aiService';

/**
 * Scheduled runs and deep research — both live on the server, because both need the API key and
 * because a scheduled run has to work when nobody is signed in.
 */

export interface Automation {
  id: string;
  name: string;
  cron: string;
  timeZone: string;
  prompt: string;
  agentId?: string;
  skillIds: string[];
  enabled: boolean;
  googleTriggerName: string;
  materializedAt: number;
  nextRunTime?: string | null;
  lastRunAt?: number;
  lastStatus?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AutomationExecution {
  id?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  interaction_id?: string;
}

const api = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(await authHeaders()), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
};

export const fetchAutomations = async (): Promise<{ available: boolean; triggers: Automation[] }> => {
  try {
    return await api('/triggers');
  } catch (e) {
    console.error('Could not load automations', e);
    return { available: false, triggers: [] };
  }
};

export const createAutomation = (body: {
  name: string; cron: string; timeZone: string; prompt: string; agentId?: string; skillIds?: string[];
}): Promise<Automation> =>
  api('/triggers', { method: 'POST', body: JSON.stringify(body) });

export const setAutomationEnabled = (id: string, enabled: boolean): Promise<Automation> =>
  api(`/triggers/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) });

export const deleteAutomation = (id: string): Promise<{ ok: boolean }> =>
  api(`/triggers/${id}`, { method: 'DELETE' });

export const runAutomationNow = (id: string): Promise<Automation> =>
  api(`/triggers/${id}/run`, { method: 'POST' });

export const fetchExecutions = async (id: string): Promise<AutomationExecution[]> => {
  try {
    const { executions } = await api(`/triggers/${id}/executions`);
    return executions || [];
  } catch (e) {
    console.error('Could not load run history', e);
    return [];
  }
};

/** Bring stale automations back in line with the assistants and skills they depend on. */
export const refreshAutomations = (): Promise<{ refreshed: number }> =>
  api('/triggers/refresh', { method: 'POST' });

// --- Deep research ---------------------------------------------------------------------------

export interface ResearchInteraction {
  id: string;
  status: string;
  steps?: Array<{ type: string; content?: any }>;
  [key: string]: any;
}

export const startResearch = (query: string): Promise<ResearchInteraction> =>
  api('/research', { method: 'POST', body: JSON.stringify({ query }) });

export const pollResearch = (id: string): Promise<ResearchInteraction> =>
  api(`/research/${id}`);

/** Research reports come back in `model_output` steps, same as any other interaction. */
export const researchReportText = (interaction: ResearchInteraction): string => {
  const parts: string[] = [];
  for (const step of interaction.steps || []) {
    if (step.type !== 'model_output') continue;
    const content: any = step.content;
    if (typeof content === 'string') parts.push(content);
    else if (Array.isArray(content)) parts.push(content.map((c: any) => c?.text || '').join(''));
    else if (content?.text) parts.push(content.text);
  }
  return parts.join('').trim();
};

/**
 * Common schedules, so nobody has to know cron. The times chosen are the ones a teacher actually
 * wants: before school, and Friday afternoon for the week's wrap-up.
 */
export const SCHEDULE_PRESETS: Array<{ label: string; cron: string }> = [
  { label: 'Every weekday at 7am', cron: '0 7 * * 1-5' },
  { label: 'Every Monday at 7am', cron: '0 7 * * 1' },
  { label: 'Every Friday at 3pm', cron: '0 15 * * 5' },
  { label: 'Every Sunday at 6pm', cron: '0 18 * * 0' },
  { label: 'First of the month at 8am', cron: '0 8 1 * *' },
];

export const describeCron = (cron: string): string =>
  SCHEDULE_PRESETS.find(p => p.cron === cron)?.label || cron;
