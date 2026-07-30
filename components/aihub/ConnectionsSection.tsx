import React, { useState } from 'react';
import { Plus, Trash2, X, Loader2, Plug, AlertTriangle } from 'lucide-react';
import { McpServerConfig } from '../../types';
import { saveMcpServer, deleteMcpServer, isValidMcpName } from '../../services/aiHubService';

/**
 * External tool servers the assistant can call, over the Model Context Protocol.
 *
 * This is how a school wires the assistant into what they already use — Microsoft 365 for email and
 * calendars, for instance. Two constraints from the provider are enforced here rather than left to
 * fail confusingly later: names must be lowercase alphanumeric (anything else returns a bare 400),
 * and the transport must be streamable HTTP, because SSE servers are not supported.
 */

interface ConnectionsSectionProps {
  servers: McpServerConfig[];
  onRefresh: () => Promise<void> | void;
}

const emptyServer = () => ({ name: '', url: '', headers: {} as Record<string, string>, allowedTools: [] as string[], enabled: true });

const ConnectionsSection: React.FC<ConnectionsSectionProps> = ({ servers, onRefresh }) => {
  const [editing, setEditing] = useState<Partial<McpServerConfig> | null>(null);
  const [saving, setSaving] = useState(false);
  const [headerText, setHeaderText] = useState('');
  const [toolsText, setToolsText] = useState('');

  const open = (server?: McpServerConfig) => {
    setEditing(server || emptyServer());
    setHeaderText(
      server?.headers ? Object.entries(server.headers).map(([k, v]) => `${k}: ${v}`).join('\n') : '',
    );
    setToolsText((server?.allowedTools || []).join(', '));
  };

  const nameError = editing?.name && !isValidMcpName(editing.name)
    ? 'Lowercase letters, numbers, hyphens and underscores only.'
    : '';
  const urlError = editing?.url && !/^https:\/\//i.test(editing.url)
    ? 'Must be an https address.'
    : '';

  const handleSave = async () => {
    if (!editing?.name?.trim() || !editing?.url?.trim() || nameError || urlError) return;
    setSaving(true);
    try {
      const headers: Record<string, string> = {};
      headerText.split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
      await saveMcpServer({
        ...editing,
        name: editing.name.trim(),
        url: editing.url.trim(),
        headers,
        allowedTools: toolsText.split(',').map(t => t.trim()).filter(Boolean),
      } as McpServerConfig);
      await onRefresh();
      setEditing(null);
    } catch (e) {
      console.error('Could not save connection', e);
      alert("Couldn't save that connection. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (server: McpServerConfig) => {
    if (!confirm(`Remove the connection to "${server.name}"?`)) return;
    await deleteMcpServer(server.id);
    await onRefresh();
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Connect the assistant to other systems your school uses, so it can work with them
          directly rather than you copying things across.
        </p>
        <button
          onClick={() => open()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Add connection
        </button>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Anything you connect can receive what the assistant sends it, and becomes a processor of
          that data. Check with whoever looks after data protection at your school before connecting
          a system that holds pupil information.
        </span>
      </div>

      {servers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <Plug className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 font-serif text-lg text-slate-700 dark:text-slate-200">No connections</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Add a Model Context Protocol server — Microsoft 365, for example — and the assistant can
            use its tools.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {servers.map(server => (
            <div key={server.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900 dark:text-white">{server.name}</h3>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{server.url}</p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button onClick={() => open(server)} className="p-1.5 text-slate-400 hover:text-primary-600" title="Edit">
                    <Plug className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(server)} className="p-1.5 text-slate-400 hover:text-red-600" title="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {server.allowedTools?.length ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Limited to: {server.allowedTools.join(', ')}
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">All of its tools are available.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
              <h2 className="font-serif text-lg text-slate-900 dark:text-white">
                {editing.id ? 'Edit connection' : 'Add connection'}
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
                  placeholder="microsoft-365"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Server address</label>
                <input
                  value={editing.url || ''}
                  onChange={e => setEditing({ ...editing, url: e.target.value })}
                  placeholder="https://example.com/mcp"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                {urlError && <p className="mt-1 text-xs text-red-600">{urlError}</p>}
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Must speak streamable HTTP. Servers that only offer SSE aren't supported.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Headers <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={headerText}
                  onChange={e => setHeaderText(e.target.value)}
                  rows={3}
                  placeholder={'Authorization: Bearer ...'}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">One per line, as <code>Name: value</code>.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Limit to these tools <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  value={toolsText}
                  onChange={e => setToolsText(e.target.value)}
                  placeholder="send_mail, list_events"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Comma separated. Leave blank to allow everything the server offers.
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
                disabled={saving || !editing.name?.trim() || !editing.url?.trim() || !!nameError || !!urlError}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionsSection;
