import React, { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Bot, MessageSquare, Brain, Upload } from 'lucide-react';
import { CustomAgent, TeacherSkill, McpServerConfig, AgentModel } from '../../types';
import { saveCustomAgent, deleteCustomAgent, setAgentMemory } from '../../services/aiHubService';
import { buildMappingFromPeople, rehydrateText, scrubText, PseudonymMapping } from '../../utils/pseudonymiser';
import { fetchColleagues } from '../../services/colleagueService';
import SensitiveDataNotice from '../SensitiveDataNotice';

/**
 * Assistants the teacher defines: a department administrator, someone who writes parent letters,
 * a head of year's briefing writer.
 *
 * These are stored here and applied to the base agent per run rather than registered with the
 * provider, so the teacher can edit one and see the change immediately, and their memory stays
 * something we hold and they can read.
 */

interface AgentsSectionProps {
  agents: CustomAgent[];
  skills: TeacherSkill[];
  servers: McpServerConfig[];
  onRefresh: () => Promise<void> | void;
  onUseAgent?: (agent: CustomAgent) => void;
}

const MODELS: Array<{ value: AgentModel; label: string; hint: string }> = [
  { value: 'gemini-3.5-flash', label: 'Balanced', hint: 'Good for almost everything' },
  { value: 'gemini-3.6-flash', label: 'Most capable', hint: 'Harder reasoning, slower' },
  { value: 'gemini-3.5-flash-lite', label: 'Fastest', hint: 'Short, simple jobs' },
];

const EXAMPLE_INSTRUCTIONS = `You help me run the geography department.

- Write in British English, plainly, no management jargon.
- When I ask for a message to staff, keep it under 150 words and put any deadline in the first line.
- Assume a UK secondary school: Years 7-13, six-period days, GCSE and A-level.
- If you need something about my school that I haven't told you, ask rather than assume.`;

const emptyAgent = (): Partial<CustomAgent> => ({
  name: '',
  description: '',
  instructions: '',
  model: 'gemini-3.5-flash',
  tools: { plannerTools: false, codeExecution: true, googleSearch: true, urlContext: true },
  mcpServerIds: [],
  skillIds: [],
  includePlannerContext: true,
  memoryEnabled: false,
});

const AgentsSection: React.FC<AgentsSectionProps> = ({ agents, skills, servers, onRefresh, onUseAgent }) => {
  const [editing, setEditing] = useState<Partial<CustomAgent> | null>(null);
  const [saving, setSaving] = useState(false);
  const [memoryView, setMemoryView] = useState<{ agent: CustomAgent; text: string; mapping: PseudonymMapping } | null>(null);
  const [savingMemory, setSavingMemory] = useState(false);
  const memoryImportInput = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!editing?.name?.trim() || !editing?.instructions?.trim()) return;
    setSaving(true);
    try {
      await saveCustomAgent({
        ...editing,
        name: editing.name.trim(),
        instructions: editing.instructions.trim(),
        // Turning on memory is the point at which standing text starts accumulating, so record
        // that the warning was shown at that moment.
        sensitiveAckAt: editing.memoryEnabled ? (editing.sensitiveAckAt || Date.now()) : editing.sensitiveAckAt,
      } as CustomAgent);
      await onRefresh();
      setEditing(null);
    } catch (e) {
      console.error('Could not save assistant', e);
      alert("Couldn't save that assistant. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (agent: CustomAgent) => {
    if (!confirm(`Delete "${agent.name}"? Anything it has remembered goes too.`)) return;
    await deleteCustomAgent(agent.id);
    await onRefresh();
  };

  /** Memory is stored as the agent wrote it — pseudonymised — so show real names only here. */
  const openMemory = async (agent: CustomAgent) => {
    const colleagues = await fetchColleagues().catch(() => []);
    const mapping = buildMappingFromPeople(colleagues.map(c => ({ name: c.name })));
    setMemoryView({ agent, text: rehydrateText(agent.memory?.content || '', mapping), mapping });
  };

  /**
   * Bring in memory from another agent — a ChatGPT export, a CLAUDE.md, a project's saved context.
   * Appended rather than replacing, so importing doesn't wipe out what this assistant has already
   * learned; the teacher can trim it in the textarea before saving either way.
   */
  const handleMemoryImport = async (file: File | undefined) => {
    if (!file || !memoryView) return;
    const imported = await file.text();
    setMemoryView({
      ...memoryView,
      text: memoryView.text.trim() ? `${memoryView.text.trim()}\n\n---\n\n${imported.trim()}` : imported.trim(),
    });
    if (memoryImportInput.current) memoryImportInput.current.value = '';
  };

  const handleSaveMemory = async () => {
    if (!memoryView) return;
    setSavingMemory(true);
    try {
      // Memory is stored pseudonymised, same as everything else that reaches the sandbox — an
      // imported file from another tool may well contain real names, so it's scrubbed on the way
      // in exactly as if the teacher had typed it into a chat message.
      const scrubbed = scrubText(memoryView.text, memoryView.mapping);
      await setAgentMemory(memoryView.agent, scrubbed);
      await onRefresh();
      setMemoryView(null);
    } catch (e) {
      console.error('Could not save memory', e);
      alert("Couldn't save that. Please try again.");
    } finally {
      setSavingMemory(false);
    }
  };

  const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Build an assistant for a job you do often. Give it standing instructions, choose what it
          can reach, and let it remember what it learns between conversations.
        </p>
        <button
          onClick={() => setEditing(emptyAgent())}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> New assistant
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <Bot className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 font-serif text-lg text-slate-700 dark:text-slate-200">No assistants yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            A department administrator, a parent-communications writer, someone who drafts your
            weekly briefing — anything you'd otherwise explain from scratch each time.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map(agent => (
            <div key={agent.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900 dark:text-white">{agent.name}</h3>
                  {agent.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{agent.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button onClick={() => setEditing(agent)} title="Edit" className="p-1.5 text-slate-400 hover:text-primary-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(agent)} title="Delete" className="p-1.5 text-slate-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {MODELS.find(m => m.value === agent.model)?.label || agent.model}
                </span>
                {agent.memoryEnabled && (
                  <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[11px] text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                    Remembers
                  </span>
                )}
                {agent.skillIds.length > 0 && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {agent.skillIds.length} skill{agent.skillIds.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                {onUseAgent && (
                  <button
                    onClick={() => onUseAgent(agent)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Chat
                  </button>
                )}
                {agent.memoryEnabled && (
                  <button
                    onClick={() => openMemory(agent)}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Brain className="h-3.5 w-3.5" /> {agent.memory?.content ? 'What it remembers' : 'Add memory'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
              <h2 className="font-serif text-lg text-slate-900 dark:text-white">
                {editing.id ? 'Edit assistant' : 'New assistant'}
              </h2>
              <button onClick={() => setEditing(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                  <input
                    value={editing.name || ''}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Department administrator"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">What is it for?</label>
                  <input
                    value={editing.description || ''}
                    onChange={e => setEditing({ ...editing, description: e.target.value })}
                    placeholder="Staff messages, rotas, meeting notes"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Standing instructions</label>
                <textarea
                  value={editing.instructions || ''}
                  onChange={e => setEditing({ ...editing, instructions: e.target.value })}
                  rows={10}
                  placeholder={EXAMPLE_INSTRUCTIONS}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>

              <SensitiveDataNotice variant="creation" />

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Model</label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {MODELS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setEditing({ ...editing, model: m.value })}
                      className={`rounded-lg border p-2 text-left text-sm transition-colors ${
                        editing.model === m.value
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="block font-medium text-slate-900 dark:text-white">{m.label}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{m.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">What it can do</label>
                <div className="space-y-2">
                  {([
                    ['googleSearch', 'Search the web'],
                    ['urlContext', 'Read web pages'],
                    ['codeExecution', 'Run code and build documents'],
                    ['plannerTools', 'Change my planner (always asks first)'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!editing.tools?.[key]}
                        onChange={e => setEditing({ ...editing, tools: { ...editing.tools!, [key]: e.target.checked } })}
                        className="rounded border-slate-300 text-primary-600"
                      />
                      <span className="text-slate-700 dark:text-slate-300">{label}</span>
                    </label>
                  ))}
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editing.includePlannerContext !== false}
                      onChange={e => setEditing({ ...editing, includePlannerContext: e.target.checked })}
                      className="rounded border-slate-300 text-primary-600"
                    />
                    <span className="text-slate-700 dark:text-slate-300">Knows my timetable and tasks</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!editing.memoryEnabled}
                      onChange={e => setEditing({ ...editing, memoryEnabled: e.target.checked })}
                      className="mt-0.5 rounded border-slate-300 text-primary-600"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      Remembers between conversations
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        You can read and edit anything it saves.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {skills.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Skills it should follow
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map(skill => {
                      const on = editing.skillIds?.includes(skill.id);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => setEditing({ ...editing, skillIds: toggleId(editing.skillIds || [], skill.id) })}
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            on
                              ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'
                          }`}
                        >
                          {skill.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Leave all unselected to let it use whichever skill fits.
                  </p>
                </div>
              )}

              {servers.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Connections</label>
                  <div className="flex flex-wrap gap-1.5">
                    {servers.map(server => {
                      const on = editing.mcpServerIds?.includes(server.id);
                      return (
                        <button
                          key={server.id}
                          onClick={() => setEditing({ ...editing, mcpServerIds: toggleId(editing.mcpServerIds || [], server.id) })}
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            on
                              ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'
                          }`}
                        >
                          {server.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.name?.trim() || !editing.instructions?.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save assistant
              </button>
            </div>
          </div>
        </div>
      )}

      {memoryView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMemoryView(null)}>
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
              <h2 className="font-serif text-lg text-slate-900 dark:text-white">
                What {memoryView.agent.name} remembers
              </h2>
              <button onClick={() => setMemoryView(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 overflow-auto p-4">
              <textarea
                value={memoryView.text}
                onChange={e => setMemoryView({ ...memoryView, text: e.target.value })}
                rows={12}
                placeholder="Nothing yet. Write something, or import from a file below."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
              <div className="flex items-center justify-between">
                <input
                  ref={memoryImportInput}
                  type="file"
                  accept=".md,.markdown,.txt,.json"
                  className="hidden"
                  onChange={e => handleMemoryImport(e.target.files?.[0])}
                />
                <button
                  onClick={() => memoryImportInput.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Upload className="h-3.5 w-3.5" /> Import from a file
                </button>
                <span className="text-xs text-slate-400">Added to the end — edit freely above.</span>
              </div>
              <SensitiveDataNotice variant="creation" />
            </div>
            <div className="flex justify-between gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
              <button
                onClick={() => setMemoryView({ ...memoryView, text: '' })}
                disabled={!memoryView.text}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-900/20"
              >
                Clear
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setMemoryView(null)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMemory}
                  disabled={savingMemory}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingMemory && <Loader2 className="h-4 w-4 animate-spin" />} Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsSection;
