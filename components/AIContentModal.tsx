import React from 'react';
import { Bot, X, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AIContentModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string | null;
    title: string;
}

export default function AIContentModal({ isOpen, onClose, content, title }: AIContentModalProps) {
    if (!isOpen || !content) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Bot size={20} className="text-blue-500" />
                            AI Generated Content
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">Linked to task: {title}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-900">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                        </ReactMarkdown>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-between items-center">
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(content);
                            // Visual feedback could go here if needed
                        }}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                    >
                        Copy to Clipboard
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <Check size={16} /> Close
                    </button>
                </div>
            </div>
        </div>
    );
}
