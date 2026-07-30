import React, { useState, useMemo, useRef } from 'react';
import {
  FileText, FileSpreadsheet, Presentation, FileType, Image as ImageIcon, Code2,
  Download, Trash2, Pin, PinOff, Upload, Loader2, Search, MessageSquarePlus, X, ShieldCheck,
} from 'lucide-react';
import { TeacherResource, ResourceType } from '../types';
import {
  saveResource, deleteResource, setResourcePinned, getResourceBlob, isPreviewable, isOfficeDocument,
} from '../services/resourceService';
import { rehydrateResourceBlob } from '../utils/documentRehydrator';
import { buildMappingFromPeople } from '../utils/pseudonymiser';
import { fetchColleagues } from '../services/colleagueService';
import PageHeading from './ui/PageHeading';
import SegmentedControl from './ui/SegmentedControl';

interface ResourcesViewProps {
  resources: TeacherResource[];
  onRefresh: () => Promise<void> | void;
  /** Hand a resource's text back to the chat as an attachment. */
  onUseInChat?: (resource: TeacherResource, text: string) => void;
}

type SourceFilter = 'all' | 'agent' | 'upload' | 'research';

const TYPE_ICONS: Record<ResourceType, React.ReactNode> = {
  docx: <FileText className="h-5 w-5" />,
  pdf: <FileType className="h-5 w-5" />,
  pptx: <Presentation className="h-5 w-5" />,
  xlsx: <FileSpreadsheet className="h-5 w-5" />,
  csv: <FileSpreadsheet className="h-5 w-5" />,
  md: <FileText className="h-5 w-5" />,
  txt: <FileText className="h-5 w-5" />,
  html: <Code2 className="h-5 w-5" />,
  png: <ImageIcon className="h-5 w-5" />,
  jpg: <ImageIcon className="h-5 w-5" />,
};

const SOURCE_LABELS: Record<TeacherResource['source'], string> = {
  agent: 'Made by the agent',
  research: 'Deep research',
  trigger: 'Scheduled run',
  upload: 'Uploaded',
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatWhen = (ts: number): string =>
  new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const ResourcesView: React.FC<ResourcesViewProps> = ({ resources, onRefresh, onUseInChat }) => {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ resource: TeacherResource; text?: string; url?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources.filter(r => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.summary || '').toLowerCase().includes(q);
    });
  }, [resources, sourceFilter, search]);

  const pinnedCount = resources.filter(r => r.pinnedToWorkspace).length;

  /**
   * Fetch a resource and put the teacher's real names back. Anything the agent produced only ever
   * saw pseudonyms, so the mapping is rebuilt from their colleagues (it is a deterministic hash,
   * so it reproduces exactly the tokens that were used).
   */
  const loadRehydrated = async (resource: TeacherResource): Promise<Blob> => {
    const blob = await getResourceBlob(resource);
    if (!resource.pseudonymised) return blob;
    const colleagues = await fetchColleagues().catch(() => []);
    const mapping = buildMappingFromPeople(colleagues.map(c => ({ name: c.name })));
    return rehydrateResourceBlob(blob, mapping, resource.type, resource.mimeType);
  };

  const handleDownload = async (resource: TeacherResource) => {
    setBusyId(resource.id);
    try {
      const blob = await loadRehydrated(resource);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resource.name;
      a.click();
      // Revoking immediately can cancel the download in some browsers; give it a moment.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error('Download failed', e);
      alert("Couldn't download that file. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handlePreview = async (resource: TeacherResource) => {
    setBusyId(resource.id);
    try {
      const blob = await loadRehydrated(resource);
      if (resource.type === 'png' || resource.type === 'jpg') {
        setPreview({ resource, url: URL.createObjectURL(blob) });
      } else {
        setPreview({ resource, text: await blob.text() });
      }
    } catch (e) {
      console.error('Preview failed', e);
    } finally {
      setBusyId(null);
    }
  };

  const handleUseInChat = async (resource: TeacherResource) => {
    if (!onUseInChat) return;
    setBusyId(resource.id);
    try {
      const blob = await loadRehydrated(resource);
      onUseInChat(resource, await blob.text());
    } catch (e) {
      console.error('Could not load resource for chat', e);
    } finally {
      setBusyId(null);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await saveResource({ name: file.name, data: file, source: 'upload' });
      }
      await onRefresh();
    } catch (e) {
      console.error('Upload failed', e);
      alert("Couldn't upload that file. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (resource: TeacherResource) => {
    if (!confirm(`Delete "${resource.name}"? This can't be undone.`)) return;
    setBusyId(resource.id);
    try {
      await deleteResource(resource);
      await onRefresh();
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setBusyId(null);
    }
  };

  const handleTogglePin = async (resource: TeacherResource) => {
    setBusyId(resource.id);
    try {
      await setResourcePinned(resource.id, !resource.pinnedToWorkspace);
      await onRefresh();
    } catch (e) {
      console.error('Pin failed', e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeading
        title="Resources"
        sub={
          resources.length === 0
            ? 'Everything you make with the AI is kept here.'
            : `${resources.length} item${resources.length === 1 ? '' : 's'}${pinnedCount ? ` · ${pinnedCount} in your workspace` : ''}`
        }
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => handleUpload(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl<SourceFilter>
          ariaLabel="Filter resources by where they came from"
          value={sourceFilter}
          onChange={setSourceFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'agent', label: 'AI-made' },
            { value: 'research', label: 'Research' },
            { value: 'upload', label: 'Uploaded' },
          ]}
        />
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search resources..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <p className="font-serif text-lg text-slate-700 dark:text-slate-200">
            {resources.length === 0 ? 'Nothing here yet' : 'Nothing matches that'}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {resources.length === 0
              ? 'Ask the agent to write a lesson plan or build a PowerPoint, and it will appear here. You can also upload your own files.'
              : 'Try a different search or filter.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(resource => {
            const busy = busyId === resource.id;
            const canPreview = isPreviewable(resource.type);
            return (
              <div
                key={resource.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-primary-600 dark:text-primary-400">
                    {TYPE_ICONS[resource.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => (canPreview ? handlePreview(resource) : handleDownload(resource))}
                      className="block w-full truncate text-left font-semibold text-slate-900 hover:text-primary-700 dark:text-white dark:hover:text-primary-400"
                      title={resource.name}
                    >
                      {resource.name}
                    </button>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {SOURCE_LABELS[resource.source]} · {formatSize(resource.size)} · {formatWhen(resource.createdAt)}
                    </p>
                  </div>
                  {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                </div>

                {resource.summary && (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{resource.summary}</p>
                )}

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                  <div className="flex items-center gap-1">
                    {resource.pinnedToWorkspace && (
                      <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[11px] font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                        In workspace
                      </span>
                    )}
                    {resource.pseudonymised && isOfficeDocument(resource.type) && (
                      <span
                        title="Names were pseudonymised while the AI worked on this. They're restored when you download it."
                        className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      >
                        <ShieldCheck className="h-3 w-3" /> Names restored
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {onUseInChat && (canPreview || isOfficeDocument(resource.type)) && (
                      <button
                        onClick={() => handleUseInChat(resource)}
                        disabled={busy}
                        title="Use in chat"
                        className="p-1.5 text-slate-400 transition-colors hover:text-primary-600 disabled:opacity-50"
                      >
                        <MessageSquarePlus className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleTogglePin(resource)}
                      disabled={busy}
                      title={resource.pinnedToWorkspace ? 'Remove from workspace' : 'Keep in the agent workspace'}
                      className="p-1.5 text-slate-400 transition-colors hover:text-primary-600 disabled:opacity-50"
                    >
                      {resource.pinnedToWorkspace ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleDownload(resource)}
                      disabled={busy}
                      title="Download"
                      className="p-1.5 text-slate-400 transition-colors hover:text-primary-600 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(resource)}
                      disabled={busy}
                      title="Delete"
                      className="p-1.5 text-slate-400 transition-colors hover:text-red-600 disabled:opacity-50"
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

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
              <h2 className="truncate font-serif text-lg text-slate-900 dark:text-white">{preview.resource.name}</h2>
              <button
                onClick={() => setPreview(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-auto p-4">
              {preview.url ? (
                <img src={preview.url} alt={preview.resource.name} className="mx-auto max-w-full" />
              ) : (
                <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-700 dark:text-slate-200">
                  {preview.text}
                </pre>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
              <button
                onClick={() => handleDownload(preview.resource)}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                <Download className="h-4 w-4" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourcesView;
