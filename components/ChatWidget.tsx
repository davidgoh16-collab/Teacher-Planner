import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Maximize2, Minimize2, List, Plus, Edit2, Trash2, Paperclip } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, AIConversation } from '../types';
import { fetchAIConversations, saveAIConversation, deleteAIConversation } from '../services/chatService';
import { readFileContent } from '../utils/fileUtils';

interface ChatWidgetProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, fileData?: { text: string, mimeType: string, isBase64: boolean }) => void;
  isLoading: boolean;
  onSetMessages: (messages: ChatMessage[]) => void;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ messages, onSendMessage, isLoading, onSetMessages }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // History State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Renaming state
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Load conversations on mount
  useEffect(() => {
    const loadConvs = async () => {
        try {
            const convs = await fetchAIConversations();
            setConversations(convs);
            if (convs.length > 0 && !currentConversationId) {
                setCurrentConversationId(convs[0].id);
                onSetMessages(convs[0].messages);
            } else if (convs.length === 0) {
                 handleNewConversation();
            }
        } catch (e) {
            console.error(e);
        }
    };
    loadConvs();
  }, []); // Run once

  // Only save conversation automatically when messages change *and* a new message is added
  // (to avoid resaving on load from history)
  const previousMessagesLengthRef = useRef(messages.length);

  useEffect(() => {
      const saveCurrent = async () => {
          if (messages.length > 0 && currentConversationId && messages.length !== previousMessagesLengthRef.current) {
              const currentConv = conversations.find(c => c.id === currentConversationId);
              const title = currentConv?.title || (messages.length > 0 ? messages[0].text.substring(0, 30) + '...' : 'New Conversation');

              const updatedConv: AIConversation = {
                  id: currentConversationId,
                  title: title,
                  messages: messages,
                  updatedAt: Date.now()
              };

              try {
                 await saveAIConversation(updatedConv);
                 setConversations(prev => {
                     const exists = prev.find(c => c.id === currentConversationId);
                     if (exists) return prev.map(c => c.id === currentConversationId ? updatedConv : c);
                     return [updatedConv, ...prev];
                 });
              } catch (e) {
                  console.error(e);
              }
          }
          previousMessagesLengthRef.current = messages.length;
      };

      saveCurrent();
  }, [messages, currentConversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

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
            console.error("Failed to read file", err);
            alert("Failed to attach file.");
            return;
        }
    }

    if (!currentConversationId) {
        setCurrentConversationId(`conv_${Date.now()}`);
    }

    onSendMessage(input, fileData);
    setInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNewConversation = () => {
      setCurrentConversationId(`conv_${Date.now()}`);
      onSetMessages([]);
      setIsHistoryOpen(false);
  };

  const handleLoadConversation = (conv: AIConversation) => {
      setCurrentConversationId(conv.id);
      onSetMessages(conv.messages);
      setIsHistoryOpen(false);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      try {
          await deleteAIConversation(id);
          setConversations(prev => prev.filter(c => c.id !== id));
          if (currentConversationId === id) {
              handleNewConversation();
          }
      } catch (err) {
          console.error(err);
      }
  };

  const handleRenameSave = async (e: React.FormEvent, conv: AIConversation) => {
      e.preventDefault();
      e.stopPropagation();
      if (!editingTitle.trim()) {
          setEditingConvId(null);
          return;
      }

      const updated = { ...conv, title: editingTitle.trim() };
      try {
          await saveAIConversation(updated);
          setConversations(prev => prev.map(c => c.id === conv.id ? updated : c));
          setEditingConvId(null);
      } catch (err) {
          console.error(err);
      }
  };

  const containerClasses = isFullScreen
    ? "fixed inset-0 z-[100] bg-white dark:bg-slate-900 flex flex-col animate-in fade-in"
    : "fixed bottom-6 right-6 z-50 flex flex-col items-end";

  const windowClasses = isFullScreen
    ? "w-full h-full flex flex-col"
    : "mb-4 w-96 max-w-[90vw] h-[500px] max-h-[70vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-slate-700 overflow-hidden transition-all animate-in slide-in-from-bottom-10 fade-in duration-200";

  return (
    <div className={containerClasses}>
      {/* Chat Window */}
      {(isOpen || isFullScreen) && (
        <div className={windowClasses}>
          
          {/* Header */}
          <div className="bg-slate-900 dark:bg-slate-950 p-4 flex justify-between items-center text-white border-b border-slate-700 shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-green-600 p-1.5 rounded-lg">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm">Planning Assistant</h3>
                <p className="text-[10px] text-slate-400">Powered by Gemini</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                  className={`p-1.5 rounded-md transition-colors ${isHistoryOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                  title="History"
                >
                  <List size={18} />
                </button>
                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                  title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                {!isFullScreen && (
                    <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                    >
                    <X size={18} />
                    </button>
                )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex relative">
              {/* History Sidebar */}
              {isHistoryOpen && (
                  <div className={`${isFullScreen ? 'w-64 border-r' : 'absolute inset-0 z-10 w-full'} bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800 flex flex-col`}>
                      <div className="p-3 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-950">
                          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Conversations</h3>
                          {!isFullScreen && (
                              <button onClick={() => setIsHistoryOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                                  <X size={16} />
                              </button>
                          )}
                      </div>
                      <div className="p-2">
                          <button onClick={handleNewConversation} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                              <Plus size={16} /> New Chat
                          </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                          {conversations.length === 0 ? (
                              <p className="text-xs text-center text-slate-500 mt-4">No history yet.</p>
                          ) : conversations.map(conv => (
                              <div
                                key={conv.id}
                                onClick={() => handleLoadConversation(conv)}
                                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm ${currentConversationId === conv.id ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'hover:bg-gray-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                              >
                                  {editingConvId === conv.id ? (
                                      <form onSubmit={(e) => handleRenameSave(e, conv)} className="flex-1 mr-2" onClick={e => e.stopPropagation()}>
                                          <input
                                            autoFocus
                                            value={editingTitle}
                                            onChange={(e) => setEditingTitle(e.target.value)}
                                            onBlur={(e) => handleRenameSave(e as any, conv)}
                                            className="w-full bg-white dark:bg-slate-950 text-xs px-2 py-1 border border-green-500 rounded focus:outline-none"
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

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-slate-950/50 flex flex-col">
                {messages.length === 0 && (
              <div className="text-center text-gray-400 dark:text-slate-500 text-sm mt-10">
                <p>Hello! I can help you plan lessons.</p>
                <p className="mt-2 text-xs">Try: "Plan a revision lesson for Year 13 on Friday"</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' 
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200' 
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
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
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-700">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="pl-1" {...props} />,
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                        a: ({node, ...props}) => <a className="text-green-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                        code: ({node, ...props}) => <code className="bg-slate-950 px-1 py-0.5 rounded text-xs font-mono text-pink-400" {...props} />,
                        pre: ({node, ...props}) => <pre className="bg-slate-950 p-3 rounded-lg overflow-x-auto text-xs font-mono my-2 border border-slate-700" {...props} />,
                        h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2 mt-3" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1 mt-2" {...props} />,
                        table: ({node, ...props}) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-slate-700 border border-slate-700 rounded-lg" {...props} /></div>,
                        th: ({node, ...props}) => <th className="px-3 py-2 bg-slate-900 text-left text-xs font-medium text-slate-300 uppercase tracking-wider border-b border-slate-700" {...props} />,
                          td: ({node, ...props}) => <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-300 border-b border-slate-800" {...props} />,
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full flex items-center justify-center shrink-0">
                  <Bot size={14} />
                </div>
                 <div className="bg-slate-800 dark:bg-slate-900 text-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">Thinking...</span>
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
            <div className="relative flex items-center">
              <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.docx,.txt,image/*"
              />
              <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="absolute left-2 p-1.5 text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors shrink-0 disabled:opacity-50 z-10"
                  title="Attach Document"
              >
                  <Paperclip size={18} />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me to add a lesson or extract actions..."
                className="w-full bg-gray-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
              />
              <button 
                type="submit"
                disabled={isLoading || (!input.trim() && !selectedFile)}
                className="absolute right-2 p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toggle Button */}
      {!isFullScreen && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 ${
              isOpen
                ? 'bg-slate-700 text-white rotate-90'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isOpen ? <X size={24} /> : <MessageCircle size={28} />}
          </button>
      )}
    </div>
  );
};

export default ChatWidget;