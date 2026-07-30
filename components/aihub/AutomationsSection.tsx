import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Loader2, Clock, Play, Pause, History } from 'lucide-react';
import { CustomAgent } from '../../types';
import {
  Automation, AutomationExecution, fetchAutomations, createAutomation, setAutomationEnabled,
  deleteAutomation, runAutomationNow, fetchExecutions, SCHEDULE_PRESETS, describeCron,
} from '../../services/automationService';
import SensitiveDataNotice from '../SensitiveDataNotice';

/**
 * Work that happens without being asked — a Monday-morning briefing, a Friday round-up.
 *
 * A scheduled run has nobody watching it, so it can't ask questions and can't be given tools that
 * change the planner (those need confirmation). It researches, writes, and files the result in
 * Resources, which is where the teacher finds it when they come in.
 */

interface AutomationsSectionProps {
  agents: CustomAgent[];
}

const emptyDraft = () => ({
  name: '',
  cron: SCHEDULE_PRESETS[1].cron,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
  prompt: '',
  agentId: '',
});

const EXAMPLE_PROMPT =
  'Look at my timetable and tasks for the coming week and write me a one-page briefing: what I\'m '
  + 'teaching each day, anything due, and three things worth preparing at the weekend. Save it as a '
  + 'Word document.';

const AutomationsSection: React.FC<AutomationsSectionProps> = ({ agents }) => {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [draft, setDraft] = useState<ReturnType<typeof emptyDraft> | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [history, setHistory] = useState<{ automation: Automation; runs: AutomationExecution[] } | null>(null);

  const refresh = async () => {
    const { available: ok, triggers } = await fetchAutomations();
    setAvailable(ok);
    setAutomations(triggers);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleCreate = async () => {
    if (!draft?.name.trim() || !draft.prompt.trim()) return;
    setSaving(true);
    try {
      await createAutomation({
        name: draft.name.trim(),
        cron: draft.cron,
        timeZone: draft.timeZone,
        prompt: draft.prompt.trim(),
        agentId: draft.agentId || undefined,
      });
      await refresh();
      setDraft(null);
    } catch (e) {
      console.error('Could not create automation', e);
      alert("Couldn't set that up. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const withBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
      await refresh();
    } catch (e) {
      console.error('Automation action failed', e);
    } finally {
      setBusyId(null);
    }
  };

  const openHistory = async (automation: Automation) => {
    setBusyId(automation.id);
    try {
      setHistory({ automation, runs: await fetchExecutions(automation.id) });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-slate-500 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Have something ready before you get in. A scheduled run works on its own and files what it
          produces in Resources.
        </p>
        {available && (
          <button
            onClick={() => setDraft(emptyDraft())}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> New automation
          </button>
        )}
      </div>

      {!available ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Scheduling isn't switched on for this deployment.
        </div>
      ) : automations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <Clock className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 font-serif text-lg text-slate-700 dark:text-slate-200">Nothing scheduled</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            A Monday-morning briefing on the week ahead, or a Friday round-up of what slipped — ready
            before you sit down.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map(a => {
            const busy = busyId === a.id;
            return (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900 dark:text-white">{a.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      {describeCron(a.cron)} · {a.timeZone}
                      {!a.enabled && ' · paused'}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{a.prompt}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                    <button
                      onClick={() => withBusy(a.id, () => runAutomationNow(a.id))}
                      disabled={busy}
                      title="Run now"
                      className="p-1.5 text-slate-400 hover:text-primary-600 disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => withBusy(a.id, () => setAutomationEnabled(a.id, !a.enabled))}
                      disabled={busy}
                      title={a.enabled ? 'Pause' : 'Resume'}
                      className="p-1.5 text-slate-400 hover:text-primary-600 disabled:opacity-50"
                    >
                      {a.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openHistory(a)}
                      disabled={busy}
                      title="Run history"
                      className="p-1.5 text-slate-400 hover:text-primary-600 disabled:opacity-50"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${a.name}"?`)) withBusy(a.id, () => deleteAutomation(a.id));
                      }}
                      disabled={busy}
                      title="Delete"
                      className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDraft(null)}>
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
              <h2 className="font-serif text-lg text-slate-900 dark:text-white">New automation</h2>
              <button onClick={() => setDraft(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-auto p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                <input
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Monday morning briefing"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">When</label>
                <select
                  value={draft.cron}
                  onChange={e => setDraft({ ...draft, cron: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                >
                  {SCHEDULE_PRESETS.map(p => <option key={p.cron} value={p.cron}>{p.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Times are in {draft.timeZone}.</p>
              </div>
              {agents.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Which assistant?
                  </label>
                  <select
                    value={draft.agentId}
                    onChange={e => setDraft({ ...draft, agentId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="">The built-in assistant</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">What should it do?</label>
                <textarea
                  value={draft.prompt}
                  onChange={e => setDraft({ ...draft, prompt: e.target.value })}
                  rows={6}
                  placeholder={EXAMPLE_PROMPT}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Nobody is there to answer questions, so say exactly what you want produced. It can't
                  change your planner on its own.
                </p>
              </div>
              <SensitiveDataNotice variant="creation" />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
              <button
                onClick={() => setDraft(null)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !draft.name.trim() || !draft.prompt.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Schedule it
              </button>
            </div>
          </div>
        </div>
      )}

      {history && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setHistory(null)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
              <h2 className="font-serif text-lg text-slate-900 dark:text-white">{history.automation.name}</h2>
              <button onClick={() => setHistory(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-auto p-4">
              {history.runs.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">It hasn't run yet.</p>
              ) : (
                <ul className="space-y-2">
                  {history.runs.map((run, i) => (
                    <li key={run.id || i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-700/50">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{run.status || 'unknown'}</span>
                      {run.start_time && (
                        <span className="ml-2 text-slate-500 dark:text-slate-400">
                          {new Date(run.start_time).toLocaleString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Anything a run produces appears in Resources.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationsSection;
