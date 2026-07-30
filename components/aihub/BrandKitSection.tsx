import React, { useState, useRef } from 'react';
import { Upload, Trash2, Loader2, Check, FileText, Presentation } from 'lucide-react';
import { BrandKit } from '../../types';
import { saveBrandKit, uploadBrandLogo, uploadBrandTemplate } from '../../services/aiHubService';

/**
 * The school's look, applied to everything the AI produces.
 *
 * Colours and fonts are handed to the agent as brand/brand.json; uploaded master documents are the
 * stronger option, because filling in a real .docx or .pptx the school already uses beats any
 * attempt to rebuild their house style from a colour list.
 */

interface BrandKitSectionProps {
  brand: BrandKit;
  onRefresh: () => Promise<void> | void;
}

const FONT_CHOICES = ['Merriweather', 'Arial', 'Calibri', 'Century Gothic', 'Comic Sans MS', 'Georgia', 'Times New Roman', 'Verdana'];

const BrandKitSection: React.FC<BrandKitSectionProps> = ({ brand, onRefresh }) => {
  const [draft, setDraft] = useState<BrandKit>(brand);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const templateInput = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<BrandKit>) => {
    setDraft(prev => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBrandKit(draft);
      await onRefresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('Could not save brand kit', e);
      alert("Couldn't save the branding. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogo = async (file: File | undefined) => {
    if (!file) return;
    setBusy('logo');
    try {
      const storagePath = await uploadBrandLogo(file);
      const next = { ...draft, logoStoragePath: storagePath };
      setDraft(next);
      await saveBrandKit(next);
      await onRefresh();
    } catch (e) {
      console.error('Logo upload failed', e);
    } finally {
      setBusy(null);
    }
  };

  const handleTemplate = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(docx|pptx)$/i.test(file.name)) {
      alert('Templates need to be a .docx or .pptx file.');
      return;
    }
    setBusy('template');
    try {
      const template = await uploadBrandTemplate(file);
      const next = { ...draft, templates: [...(draft.templates || []), template] };
      setDraft(next);
      await saveBrandKit(next);
      await onRefresh();
    } catch (e) {
      console.error('Template upload failed', e);
    } finally {
      setBusy(null);
      if (templateInput.current) templateInput.current.value = '';
    }
  };

  const removeTemplate = async (id: string) => {
    const next = { ...draft, templates: draft.templates.filter(t => t.id !== id) };
    setDraft(next);
    await saveBrandKit(next);
    await onRefresh();
  };

  const colourField = (key: keyof BrandKit['colors'], label: string) => (
    <div key={key}>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={draft.colors[key]}
          onChange={e => update({ colors: { ...draft.colors, [key]: e.target.value } })}
          className="h-9 w-12 cursor-pointer rounded border border-slate-200 dark:border-slate-600"
        />
        <input
          value={draft.colors[key]}
          onChange={e => update({ colors: { ...draft.colors, [key]: e.target.value } })}
          className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl">
      <p className="mb-5 text-sm text-slate-600 dark:text-slate-400">
        Everything the assistant produces picks this up — documents, presentations and handouts come
        out looking like they came from your school.
      </p>

      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">School</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Name on documents</label>
              <input
                value={draft.displayName || ''}
                onChange={e => update({ displayName: e.target.value })}
                placeholder="Thamesview School"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Logo</label>
              <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={e => handleLogo(e.target.files?.[0])} />
              <button
                onClick={() => logoInput.current?.click()}
                disabled={busy === 'logo'}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {busy === 'logo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {draft.logoStoragePath ? 'Replace logo' : 'Upload logo'}
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Header text</label>
              <input
                value={draft.headerText || ''}
                onChange={e => update({ headerText: e.target.value })}
                placeholder="Geography Department"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Footer text</label>
              <input
                value={draft.footerText || ''}
                onChange={e => update({ footerText: e.target.value })}
                placeholder="Learning together, achieving together"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Colours</h3>
          <div className="flex flex-wrap gap-4">
            {colourField('primary', 'Primary')}
            {colourField('secondary', 'Secondary')}
            {colourField('accent', 'Accent')}
            {colourField('text', 'Body text')}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Fonts</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['heading', 'body'] as const).map(which => (
              <div key={which}>
                <label className="mb-1 block text-xs font-medium capitalize text-slate-600 dark:text-slate-400">{which}</label>
                <select
                  value={draft.fonts[which]}
                  onChange={e => update({ fonts: { ...draft.fonts, [which]: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                >
                  {FONT_CHOICES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">Templates</h3>
            <input
              ref={templateInput}
              type="file"
              accept=".docx,.pptx"
              className="hidden"
              onChange={e => handleTemplate(e.target.files?.[0])}
            />
            <button
              onClick={() => templateInput.current?.click()}
              disabled={busy === 'template'}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {busy === 'template' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </button>
          </div>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Upload a .docx or .pptx your school already uses and the assistant fills that in, rather
            than trying to rebuild your house style from scratch.
          </p>
          {draft.templates?.length ? (
            <ul className="space-y-1">
              {draft.templates.map(t => (
                <li key={t.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-700/50">
                  {t.type === 'pptx' ? <Presentation className="h-4 w-4 text-slate-400" /> : <FileText className="h-4 w-4 text-slate-400" />}
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{t.name}</span>
                  <button onClick={() => removeTemplate(t.id)} className="p-1 text-slate-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No templates yet.</p>
          )}
        </section>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save branding
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-primary-700 dark:text-primary-400">
            <Check className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandKitSection;
