import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface ChatWidgetProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ messages, onSendMessage, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-96 max-w-[90vw] h-[500px] max-h-[70vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-slate-700 overflow-hidden transition-all animate-in slide-in-from-bottom-10 fade-in duration-200">
          
          {/* Header */}
          <div className="bg-slate-900 dark:bg-slate-950 p-4 flex justify-between items-center text-white border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="bg-green-600 p-1.5 rounded-lg">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm">Planning Assistant</h3>
                <p className="text-[10px] text-slate-400">Powered by Gemini</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-slate-950/50">
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

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me to add a lesson..."
                className="w-full bg-gray-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
              />
              <button 
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toggle Button */}
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
    </div>
  );
};

export default ChatWidget;