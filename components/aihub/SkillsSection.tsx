import React, { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, BookMarked, Upload, FolderOpen, Download, CheckCircle2 } from 'lucide-react';
import { TeacherSkill } from '../../types';
import { saveSkill, deleteSkill, slugify, importSkillFile, getSkillAssetBlob } from '../../services/aiHubService';

/** "3 hours ago", "2 days ago"... falling back to a date once it's been a while. */
const formatRelative = (ts: number): string => {
  const diffMs = Date.now() - ts;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Skills: the teacher's own ways of doing things, taught once and reused.
 *
 * A skill is really just instructions with a name, but naming it matters — it becomes a directory
 * the agent discovers in its sandbox, so "my lesson plan format" turns into something it checks
 * before writing anything rather than something the teacher re-explains every time.
 */

interface SkillsSectionProps {
  skills: TeacherSkill[];
  onRefresh: () => Promise<void> | void;
}

const EXAMPLE = `Use this format for every lesson plan:

1. **Learning objectives** — as All / Most / Some (must, should, could).
2. **Starter** (10 minutes) — a hook that needs no prior knowledge.
3. **Main activities** — two, with a clear check for understanding after each.
4. **Plenary** (5 minutes) — students self-assess against the objectives.
5. **Key vocabulary** — a short list with definitions.

Keep the language plain enough to hand to a cover teacher.`;

const SkillsSection: React.FC<SkillsSectionProps> = ({ skills, onRefresh }) => {
  const [editing, setEditing] = useState<Partial<TeacherSkill> | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const startNew = () => setEditing({ name: '', description: '', instructions: '', enabled: true });

  const handleImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImporting(true);
    setImportStatus(null);
    const imported: string[] = [];
    const failed: string[] = [];
    const assetFailures: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const { skill, failedAssets } = await importSkillFile(file);
        imported.push(skill.name);
        // A skill with SKILL.md saved but some of its reference files/scripts missing is a
        // partial import, not a success — say so rather than reporting it as clean.
        if (failedAssets.length) assetFailures.push(`${skill.name} (${failedAssets.join(', ')})`);
      } catch (e) {
        console.error(`Could not import ${file.name}`, e);
        failed.push(file.name);
      }
    }
    await onRefresh();
    setImporting(false);
    if (importInput.current) importInput.current.value = '';
    const parts = [];
    if (imported.length) parts.push(`Imported ${imported.length === 1 ? '"' + imported[0] + '"' : imported.length + ' skills'}.`);
    if (assetFailures.length) parts.push(`Some supporting files didn't come across — ${assetFailures.join('; ')}.`);
    if (failed.length) parts.push(`Couldn't read: ${failed.join(', ')}.`);
    setImportStatus(parts.join(' '));
  };

  const handleSave = async () => {
    if (!editing?.name?.trim() || !editing?.instructions?.trim()) return;
    setSaving(true);
    try {
      await saveSkill({
        ...editing,
        name: editing.name.trim(),
        instructions: editing.instructions.trim(),
        slug: editing.slug || slugify(editing.name),
      } as TeacherSkill);
      await onRefresh();
      setEditing(null);
    } catch (e) {
      console.error('Could not save skill', e);
      alert("Couldn't save that skill. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (skill: TeacherSkill) => {
    if (!confirm(`Delete "${skill.name}"?`)) return;
    await deleteSkill(skill);
    await onRefresh();
  };

  const toggleEnabled = async (skill: TeacherSkill) => {
    await saveSkill({ ...skill, enabled: !skill.enabled });
    await onRefresh();
  };

  const [filesView, setFilesView] = useState<TeacherSkill | null>(null);
  const [downloadingAsset, setDownloadingAsset] = useState<string | null>(null);

  /**
   * Download an imported file so a teacher can actually open it and check it's the real thing —
   * not just trust a filename in a list. This is what surfaced the nested-folder import bug: the
   * list alone would have kept looking fine.
   */
  const handleDownloadAsset = async (asset: NonNullable<TeacherSkill['assets']>[number]) => {
    setDownloadingAsset(asset.storagePath);
    try {
      const blob = await getSkillAssetBlob(asset);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = asset.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error('Could not download asset', e);
      alert("Couldn't download that file.");
    } finally {
      setDownloadingAsset(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Save the way you like things done — your lesson plan format, how you word a parent email,
          your department's marking codes. The assistant checks these before it writes anything.
          Already have skills from Claude or another AI agent? Import their <code>.skill</code> files
          straight in.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <input
            ref={importInput}
            type="file"
            accept=".skill,.zip,.md,.markdown"
            multiple
            className="hidden"
            onChange={e => handleImport(e.target.files)}
          />
          <button
            onClick={() => importInput.current?.click()}
            disabled={importing}
            title="Import a .skill file — from Claude or another AI agent"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import .skill
          </button>
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> New skill
          </button>
        </div>
      </div>

      {importStatus && (
        <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
          {importStatus}
        </p>
      )}

      {skills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <BookMarked className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 font-serif text-lg text-slate-700 dark:text-slate-200">No skills yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Add your lesson-plan format and every plan the assistant writes will follow it — no need
            to explain it again each time.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {skills.map(skill => (
            <div
              key={skill.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900 dark:text-white">{skill.name}</h3>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">.agents/skills/{skill.slug}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => setEditing(skill)}
                    title="Edit"
                    className="p-1.5 text-slate-400 hover:text-primary-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(skill)}
                    title="Delete"
                    className="p-1.5 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {skill.description && (
                <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{skill.description}</p>
              )}

              <p className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                {skill.usageCount ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-primary-600 dark:text-primary-400" />
                    Used {skill.usageCount} time{skill.usageCount === 1 ? '' : 's'}
                    {skill.lastUsedAt ? ` · last ${formatRelative(skill.lastUsedAt)}` : ''}
                  </>
                ) : (
                  <span className="text-slate-400">Not used yet</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Type <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-700">/{skill.slug}</code> in chat to use it directly.
              </p>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    onChange={() => toggleEnabled(skill)}
                    className="rounded border-slate-300 text-primary-600"
                  />
                  <span className="text-slate-600 dark:text-slate-400">
                    {skill.enabled ? 'In use' : 'Paused'}
                  </span>
                </label>
                {!!skill.assets?.length && (
                  <button
                    onClick={() => setFilesView(skill)}
                    className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary-600 dark:text-slate-400"
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> {skill.assets.length} file{skill.assets.length === 1 ? '' : 's'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div
            className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
              <h2 className="font-serif text-lg text-slate-900 dark:text-white">
                {editing.id ? 'Edit skill' : 'New skill'}
              </h2>
              <button onClick={() => setEditing(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-auto p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                <input
                  value={editing.name || ''}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  placeholder="My lesson plan format"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  When should it be used?
                </label>
                <input
                  value={editing.description || ''}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Whenever writing a lesson plan"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  This is how the assistant decides whether a skill applies, so be specific.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  How should it be done?
                </label>
                <textarea
                  value={editing.instructions || ''}
                  onChange={e => setEditing({ ...editing, instructions: e.target.value })}
                  rows={14}
                  placeholder={EXAMPLE}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Write it as you'd explain it to a new colleague. Markdown is fine.
                </p>
              </div>
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
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save skill
              </button>
            </div>
          </div>
        </div>
      )}

      {filesView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setFilesView(null)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
              <div>
                <h2 className="font-serif text-lg text-slate-900 dark:text-white">{filesView.name}</h2>
                <p className="font-mono text-xs text-slate-400">.agents/skills/{filesView.slug}/</p>
              </div>
              <button onClick={() => setFilesView(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-auto p-4">
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Everything that came with this skill's package, alongside SKILL.md. Download one to
                check it's really there and unchanged.
              </p>
              <ul className="space-y-1">
                {(filesView.assets || []).map(asset => (
                  <li
                    key={asset.storagePath}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-700/50"
                  >
                    <span className="min-w-0 truncate font-mono text-slate-700 dark:text-slate-200" title={asset.name}>
                      {asset.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-slate-400">{formatSize(asset.size)}</span>
                      <button
                        onClick={() => handleDownloadAsset(asset)}
                        disabled={downloadingAsset === asset.storagePath}
                        className="p-1 text-slate-400 hover:text-primary-600 disabled:opacity-50"
                        title="Download"
                      >
                        {downloadingAsset === asset.storagePath
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Download className="h-4 w-4" />}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillsSection;
