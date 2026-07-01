import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Loader2, Maximize2, Minimize2, List, Plus, Edit2, Trash2, Paperclip, Sparkles, Brain, Search, Code, Wrench, BarChart3, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, AIConversation } from '../types';
import { AgentActivityItem } from '../services/agentService';
import { readFileContent } from '../utils/fileUtils';

/** Live trace of an in-flight agent run, surfaced as the streamed "thought process". */
export interface AgentTrace {
  reasoning: string;
  activity: AgentActivityItem[];
  answer: string;
}

const activityIcon = (kind: AgentActivityItem['kind']) => {
  switch (kind) {
    case 'search': return <Search size={13} />;
    case 'code': return <Code size={13} />;
    case 'tool': return <Wrench size={13} />;
    case 'thinking': return <Brain size={13} />;
    default: return <Sparkles size={13} />;
  }
};

/**
 * Render an agent-generated interactive visualization (a self-contained HTML document) inside a
 * sandboxed iframe. `sandbox="allow-scripts"` lets charting libraries run but isolates the frame
 * from the app — no same-origin access, so it cannot reach cookies, the DOM, or Firebase.
 */
const VizFrame: React.FC<{ html: string }> = ({ html }) => {
  const [expanded, setExpanded] = useState(false);
  const [showSource, setShowSource] = useState(false);
  return (
    <div className="my-2 rounded-xl border border-slate-700 overflow-hidden bg-white dark:bg-slate-950">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-700">
        <span className="flex items-center gap-1.5 text-xs font-medium text-primary-300">
          <BarChart3 size={13} /> Interactive view
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSource(s => !s)}
            className="p-1 text-slate-400 hover:text-slate-100 rounded transition-colors"
            title={showSource ? 'Show chart' : 'View source'}
          >
            <Code size={14} />
          </button>
          <button
            onClick={() => {
              const w = window.open('', '_blank');
              if (w) { w.document.open(); w.document.write(html); w.document.close(); }
            }}
            className="p-1 text-slate-400 hover:text-slate-100 rounded transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1 text-slate-400 hover:text-slate-100 rounded transition-colors"
            title={expanded ? 'Shrink' : 'Expand'}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
      {showSource ? (
        <pre className="bg-slate-950 p-3 overflow-x-auto text-xs font-mono text-slate-300 max-h-[60vh]">{html}</pre>
      ) : (
        <iframe
          title="Agent visualization"
          sandbox="allow-scripts allow-popups"
          srcDoc={html}
          className={`w-full bg-white transition-all ${expanded ? 'h-[80vh]' : 'h-[420px]'}`}
        />
      )}
    </div>
  );
};

// A streamed answer may contain a not-yet-closed ```html block; show a placeholder until it closes.
const VizBuilding: React.FC = () => (
  <div className="my-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-xs text-slate-400">
    <Loader2 size={14} className="animate-spin" /> Building interactive visualization…
  </div>
);

export type ChatPanelLayout = 'embedded' | 'floating' | 'fullscreen';

export interface ChatPanelProps {
  layout?: ChatPanelLayout;

  // Chat data
  messages: ChatMessage[];
  onSendMessage: (message: string, fileData?: { text: string, mimeType: string, isBase64: boolean, fileName?: string }) => void;
  isLoading: boolean;

  // Agent mode (Antigravity managed agent) toggle
  agentMode?: boolean;
  onToggleAgentMode?: () => void;
  // Visualization toggle (agent mode only): off = faster, text-only answers.
  vizEnabled?: boolean;
  onToggleViz?: () => void;
  // Live thought process of the in-flight agent run (reasoning + activity + streaming answer).
  agentTrace?: AgentTrace | null;

  // Conversation management (from useChatConversations — usually spread in)
  conversations: AIConversation[];
  currentConversationId: string | null;
  editingConvId: string | null;
  editingTitle: string;
  setEditingConvId: (id: string | null) => void;
  setEditingTitle: (title: string) => void;
  ensureConversation: () => void;
  handleNewConversation: () => void;
  handleLoadConversation: (conv: AIConversation) => void;
  handleDeleteConversation: (e: React.MouseEvent, id: string) => void;
  handleRenameSave: (e: React.FormEvent, conv: AIConversation) => void;

  // Pending AI action confirmation
  pendingConfirmation?: { summary: string } | null;
  onConfirmActions?: () => void;
  onCancelActions?: () => void;

  // Header slots / controls
  liveAssistantButton?: React.ReactNode;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onClose?: () => void;

  // Optional empty-state override (e.g. Home hero supplies its own greeting/prompts)
  emptyState?: React.ReactNode;
}

/**
 * The shared chat props passed around the app (built once in App.tsx as `chatBag`).
 * Layout-specific controls are supplied by each chat surface, not shared.
 */
export type ChatBag = Omit<ChatPanelProps, 'layout' | 'isFullScreen' | 'onToggleFullScreen' | 'onClose' | 'emptyState'>;

const ChatPanel: React.FC<ChatPanelProps> = ({
  layout = 'floating',
  messages,
  onSendMessage,
  isLoading,
  agentMode,
  onToggleAgentMode,
  vizEnabled,
  onToggleViz,
  agentTrace,
  conversations,
  currentConversationId,
  editingConvId,
  editingTitle,
  setEditingConvId,
  setEditingTitle,
  ensureConversation,
  handleNewConversation,
  handleLoadConversation,
  handleDeleteConversation,
  handleRenameSave,
  pendingConfirmation,
  onConfirmActions,
  onCancelActions,
  liveAssistantButton,
  isFullScreen,
  onToggleFullScreen,
  onClose,
  emptyState,
}) => {
  const [input, setInput] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // History is shown as an inline rail in wide layouts, or an overlay in the narrow popover.
  const historyInline = layout === 'embedded' || layout === 'fullscreen' || !!isFullScreen;

  const remarkPlugins = React.useMemo(() => [remarkGfm], []);
  const markdownComponents = React.useMemo(() => ({
    ul: ({node, ...props}: any) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1" {...props} />,
    li: ({node, ...props}: any) => <li className="pl-1" {...props} />,
    p: ({node, ...props}: any) => <p className="mb-2 last:mb-0" {...props} />,
    strong: ({node, ...props}: any) => <strong className="font-bold text-white" {...props} />,
    a: ({node, ...props}: any) => <a className="text-green-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
    code: ({node, ...props}: any) => <code className="bg-slate-950 px-1 py-0.5 rounded text-xs font-mono text-pink-400" {...props} />,
    pre: ({node, ...props}: any) => <pre className="bg-slate-950 p-3 rounded-lg overflow-x-auto text-xs font-mono my-2 border border-slate-700" {...props} />,
    h1: ({node, ...props}: any) => <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="text-base font-bold mb-2 mt-3" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="text-sm font-bold mb-1 mt-2" {...props} />,
    table: ({node, ...props}: any) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-slate-700 border border-slate-700 rounded-lg" {...props} /></div>,
    th: ({node, ...props}: any) => <th className="px-3 py-2 bg-slate-900 text-left text-xs font-medium text-slate-300 uppercase tracking-wider border-b border-slate-700" {...props} />,
    td: ({node, ...props}: any) => <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-300 border-b border-slate-800" {...props} />,
  }), []);

  const mdClass = "prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-700";
  const mdBlock = (text: string, key?: number) => (
    <div key={key} className={mdClass}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents}>{text}</ReactMarkdown>
    </div>
  );

  // Render a model answer, extracting agent-generated ```html visualizations into sandboxed
  // iframes (VizFrame) and rendering the surrounding prose as markdown. Handles a partially
  // streamed (unclosed) ```html block by showing a "building…" placeholder.
  const renderRich = (text: string): React.ReactNode => {
    if (!text.includes('```html')) return mdBlock(text);
    const nodes: React.ReactNode[] = [];
    const re = /```html\s*\n?([\s\S]*?)```/gi;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(text)) !== null) {
      const before = text.slice(lastIndex, m.index);
      if (before.trim()) nodes.push(mdBlock(before, key++));
      nodes.push(<VizFrame key={key++} html={m[1]} />);
      lastIndex = re.lastIndex;
    }
    const rest = text.slice(lastIndex);
    const openIdx = rest.indexOf('```html');
    if (openIdx !== -1) {
      // An unterminated visualization is still streaming in.
      const beforeOpen = rest.slice(0, openIdx);
      if (beforeOpen.trim()) nodes.push(mdBlock(beforeOpen, key++));
      nodes.push(<VizBuilding key={key++} />);
    } else if (rest.trim()) {
      nodes.push(mdBlock(rest, key++));
    }
    return <>{nodes}</>;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || isLoading) return;

    let fileData;
    if (selectedFile) {
      try {
        fileData = await readFileContent(selectedFile);
      } catch (err) {
        console.error('Failed to read file', err);
        alert('Failed to attach file.');
        return;
      }
    }

    ensureConversation();
    onSendMessage(input, fileData);
    setInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onNewChat = () => {
    handleNewConversation();
    setIsHistoryOpen(false);
  };
  const onPickConversation = (conv: AIConversation) => {
    handleLoadConversation(conv);
    setIsHistoryOpen(false);
  };

  const rootClass =
    layout === 'embedded'
      ? 'flex flex-col h-full w-full bg-white dark:bg-slate-900 overflow-hidden'
      : layout === 'fullscreen' || isFullScreen
        ? 'fixed inset-0 z-[100] bg-white dark:bg-slate-900 flex flex-col'
        : 'w-96 max-w-[90vw] h-[500px] max-h-[70vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-slate-700 overflow-hidden';

  return (
    <div className={rootClass}>
      {/* Slim control strip — blends with the chat area (no branded bar) */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-slate-950/50 shrink-0">
        <button
          onClick={() => setIsHistoryOpen(!isHistoryOpen)}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${isHistoryOpen ? 'bg-gray-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-800'}`}
          title="Conversations"
        >
          <List size={16} /> <span className="hidden sm:inline">Conversations</span>
        </button>
        {onToggleAgentMode && (
          <button
            onClick={onToggleAgentMode}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${agentMode ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-800'}`}
            title={agentMode ? 'Agent mode on — runs autonomous, multi-step tasks (web, code, files). Click to switch back to quick chat.' : 'Turn on Agent mode for autonomous, multi-step tasks (web research, document generation).'}
            aria-pressed={!!agentMode}
          >
            <Sparkles size={16} /> <span className="hidden sm:inline">Agent</span>
          </button>
        )}
        {agentMode && onToggleViz && (
          <button
            onClick={onToggleViz}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${vizEnabled ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-800'}`}
            title={vizEnabled ? 'Visualizations on — the agent builds interactive charts. Click for faster, text-only answers.' : 'Visualizations off — faster, text-only answers. Click to let the agent build interactive charts.'}
            aria-pressed={!!vizEnabled}
          >
            <BarChart3 size={16} /> <span className="hidden sm:inline">Visuals</span>
          </button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
          {onClose && !isFullScreen && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex relative">
        {/* History sidebar */}
        {isHistoryOpen && (
          <div className={`${historyInline ? 'w-64 border-r' : 'absolute inset-0 z-10 w-full'} bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800 flex flex-col`}>
            <div className="p-3 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-950">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Conversations</h3>
              {!historyInline && (
                <button onClick={() => setIsHistoryOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="p-2">
              <button onClick={onNewChat} className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                <Plus size={16} /> New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.length === 0 ? (
                <p className="text-xs text-center text-slate-500 mt-4">No history yet.</p>
              ) : conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => onPickConversation(conv)}
                  className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm ${currentConversationId === conv.id ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300' : 'hover:bg-gray-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                >
                  {editingConvId === conv.id ? (
                    <form onSubmit={(e) => handleRenameSave(e, conv)} className="flex-1 mr-2" onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={(e) => handleRenameSave(e as any, conv)}
                        className="w-full bg-white dark:bg-slate-950 text-xs px-2 py-1 border border-primary-500 rounded focus:outline-none"
                      />
                    </form>
                  ) : (
                    <span className="truncate flex-1 mr-2">{conv.title}</span>
                  )}

                  {editingConvId !== conv.id && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); setEditingConvId(conv.id); setEditingTitle(conv.title); }} className="text-slate-400 hover:text-blue-500 p-1">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={(e) => handleDeleteConversation(e, conv.id)} className="text-slate-400 hover:text-red-500 p-1">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-slate-950/50 flex flex-col">
          {messages.length === 0 && (
            emptyState ?? (
              <div className="text-center text-gray-400 dark:text-slate-500 text-sm mt-10">
                <p>Hello! I can help you plan lessons.</p>
                <p className="mt-2 text-xs">Try: "Plan a revision lesson for Year 13 on Friday"</p>
              </div>
            )
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user'
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
              }`}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={`rounded-2xl px-4 py-2.5 text-sm max-w-[85%] shadow-sm ${
                msg.role === 'user'
                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tr-none'
                  : 'bg-slate-800 dark:bg-slate-900 text-slate-200 rounded-tl-none'
              }`}>
                {msg.role === 'user' ? (
                  msg.text
                ) : (
                  <>
                    {msg.thoughts && (
                      <details className="mb-2 group">
                        <summary className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-200 select-none list-none">
                          <Brain size={13} /> Show thinking
                        </summary>
                        <div className="mt-2 pl-2 border-l-2 border-slate-700 prose prose-xs dark:prose-invert max-w-none text-slate-400 prose-p:my-1 prose-headings:text-slate-300 prose-headings:text-xs">
                          <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents}>
                            {msg.thoughts}
                          </ReactMarkdown>
                        </div>
                      </details>
                    )}
                    {renderRich(msg.text)}
                  </>
                )}
              </div>
            </div>
          ))}
          {isLoading && agentMode && agentTrace ? (
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full flex items-center justify-center shrink-0">
                <Sparkles size={14} />
              </div>
              <div className="bg-slate-800 dark:bg-slate-900 text-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm max-w-[85%] w-full space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-primary-300">
                  <Loader2 size={14} className="animate-spin" /> Agent working…
                </div>

                {/* Activity feed — what the agent is doing right now */}
                {agentTrace.activity.length > 0 && (
                  <ul className="space-y-1">
                    {agentTrace.activity.map((item, i) => {
                      const isLast = i === agentTrace.activity.length - 1;
                      return (
                        <li key={i} className={`flex items-center gap-1.5 text-xs ${isLast ? 'text-slate-200' : 'text-slate-500'}`}>
                          <span className="shrink-0">{activityIcon(item.kind)}</span>
                          <span>{item.label}{item.detail ? `: ${item.detail}` : ''}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Streaming reasoning summary */}
                {agentTrace.reasoning.trim() && (
                  <div className="pt-1 border-t border-slate-700/60">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                      <Brain size={12} /> Reasoning
                    </div>
                    <div className="text-xs text-slate-400 whitespace-pre-wrap max-h-40 overflow-y-auto">{agentTrace.reasoning}</div>
                  </div>
                )}

                {/* Streaming answer (with live-rendered visualizations) */}
                {agentTrace.answer.trim() && (
                  <div className="pt-1 border-t border-slate-700/60">
                    {renderRich(agentTrace.answer)}
                  </div>
                )}
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full flex items-center justify-center shrink-0">
                <Bot size={14} />
              </div>
              <div className="bg-slate-800 dark:bg-slate-900 text-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">{agentMode ? 'Agent working… this can take a minute' : 'Thinking...'}</span>
              </div>
            </div>
          ) : null}

          {pendingConfirmation && (
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full flex items-center justify-center shrink-0">
                <Bot size={14} />
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1.5">Confirm these changes to your planner?</p>
                <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap mb-3">{pendingConfirmation.summary}</div>
                <div className="flex gap-2">
                  <button onClick={() => onConfirmActions?.()} className="px-3 py-1 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors">
                    Confirm
                  </button>
                  <button onClick={() => onCancelActions?.()} className="px-3 py-1 text-xs font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 shrink-0">
        {selectedFile && (
          <div className="mb-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-medium truncate">
              <Paperclip size={12} /> {selectedFile.name}
            </span>
            <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 p-0.5">
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl pl-2 pr-1.5 py-1 focus-within:ring-2 focus-within:ring-primary-500/50 transition-all">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.docx,.xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.pptx,.txt,.md,.json,image/*"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors shrink-0 disabled:opacity-50"
            title="Attach a file — PDF, image, Word, Excel/CSV, PowerPoint or text"
          >
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={agentMode ? 'Give the agent a task — research, draft, multi-step…' : 'Ask me to add a lesson or extract actions...'}
            /* Security: limit input length to prevent excessive token usage */
            maxLength={2000}
            className="flex-1 min-w-0 bg-transparent text-slate-800 dark:text-slate-100 py-2 text-sm focus:outline-none"
          />
          {/* Voice assistant (mic) sits right beside the send button */}
          {liveAssistantButton && <div className="shrink-0">{liveAssistantButton}</div>}
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && !selectedFile)}
            className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            title="Send"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
