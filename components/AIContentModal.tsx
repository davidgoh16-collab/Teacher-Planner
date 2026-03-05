import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Check, Edit2, RotateCcw, Save, Loader2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleGenAI } from '@google/genai';

interface AIContentModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string | null;
    title: string;
    onSave?: (newContent: string) => Promise<void>;
}

export default function AIContentModal({ isOpen, onClose, content, title, onSave }: AIContentModalProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(content || '');
    const [history, setHistory] = useState<string[]>([]);

    // AI Edit State
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGeneratingPro, setIsGeneratingPro] = useState(false);

    // Selection state for targeted editing
    const [selectionStart, setSelectionStart] = useState<number | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Memoize remark plugins
    const remarkPlugins = React.useMemo(() => [remarkGfm], []);

    // Reset state when modal opens with new content
    useEffect(() => {
        if (isOpen && content) {
            setEditedContent(content);
            setHistory([content]);
            setIsEditing(false);
            setAiPrompt('');
            setSelectedText('');
            setSelectionStart(null);
            setSelectionEnd(null);
        }
    }, [isOpen, content]);

    if (!isOpen || !content) return null;

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditedContent(e.target.value);
    };

    const handleSelection = () => {
        if (textareaRef.current) {
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            if (start !== end) {
                setSelectionStart(start);
                setSelectionEnd(end);
                setSelectedText(textareaRef.current.value.substring(start, end));
            } else {
                setSelectionStart(null);
                setSelectionEnd(null);
                setSelectedText('');
            }
        }
    };

    const saveToHistory = (newText: string) => {
        setHistory(prev => [...prev, newText]);
    };

    const handleUndo = () => {
        if (history.length > 1) {
            const newHistory = [...history];
            newHistory.pop(); // Remove current state
            const previousState = newHistory[newHistory.length - 1];
            setEditedContent(previousState);
            setHistory(newHistory);
        }
    };

    const handleSave = async () => {
        if (onSave) {
            await onSave(editedContent);
        }
        setIsEditing(false);
    };

    const handleRegenerateWithPro = async () => {
        setIsGeneratingPro(true);
        try {
            const apiKey = window.ENV?.GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || window.ENV?.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
            const ai = new GoogleGenAI({ apiKey });

            const systemPrompt = `You are a professional assistant. Please rewrite and elevate the following content to be more comprehensive, professional, and well-structured.`;
            const prompt = `Please rewrite this content to be better:\n\n${editedContent}`;

            const response = await ai.models.generateContent({
                model: 'gemini-3.1-pro-preview',
                contents: prompt,
                config: {
                    systemInstruction: systemPrompt,
                }
            });

            if (response.text) {
                saveToHistory(editedContent);
                setEditedContent(response.text);
            }
        } catch (error) {
            console.error("AI Regenerate Pro Error:", error);
            alert("Failed to regenerate with Pro model.");
        } finally {
            setIsGeneratingPro(false);
        }
    };

    const handleAiEdit = async () => {
        if (!aiPrompt.trim()) return;

        setIsAiLoading(true);
        try {
            const apiKey = window.ENV?.GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || window.ENV?.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
            const ai = new GoogleGenAI({ apiKey });

            let systemPrompt = "";
            let prompt = "";

            if (selectedText && selectionStart !== null && selectionEnd !== null) {
                // Edit only selected text
                systemPrompt = `You are an expert editor. The user wants to modify a SPECIFIC SECTION of their document.
                Below is the entire document for context, but you MUST ONLY return the updated version of the targeted section.
                Do not return the rest of the document. Do not wrap in markdown code blocks unless requested.`;

                prompt = `
                ENTIRE DOCUMENT CONTEXT:
                ${editedContent}

                ---
                TARGET SECTION TO MODIFY:
                ${selectedText}

                ---
                USER INSTRUCTION:
                ${aiPrompt}
                `;
            } else {
                // Edit entire document
                systemPrompt = `You are an expert editor. The user wants to modify their document based on an instruction.
                Return the entire modified document. Do not wrap your response in markdown code blocks unless it's a code snippet. Keep the formatting as markdown.`;

                prompt = `
                CURRENT DOCUMENT:
                ${editedContent}

                ---
                USER INSTRUCTION:
                ${aiPrompt}
                `;
            }

            const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
                contents: prompt,
                config: {
                    systemInstruction: systemPrompt,
                }
            });

            let newText = response.text || "";

            // Clean up potential markdown code block wrapping from the model
            if (newText.startsWith('\`\`\`markdown\n')) {
                newText = newText.substring(12, newText.length - 3);
            } else if (newText.startsWith('\`\`\`\n')) {
                newText = newText.substring(4, newText.length - 3);
            }

            if (selectedText && selectionStart !== null && selectionEnd !== null) {
                // Replace only the selected part
                const before = editedContent.substring(0, selectionStart);
                const after = editedContent.substring(selectionEnd);
                const finalContent = before + newText + after;
                setEditedContent(finalContent);
                saveToHistory(finalContent);
                // Clear selection
                setSelectedText('');
                setSelectionStart(null);
                setSelectionEnd(null);
            } else {
                // Replace everything
                setEditedContent(newText);
                saveToHistory(newText);
            }

            setAiPrompt('');

            // Automatically switch to edit mode to review changes
            setIsEditing(true);

        } catch (error) {
            console.error("AI Edit Error:", error);
            alert("Failed to generate edit.");
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Bot size={20} className="text-blue-500" />
                            AI Generated Content
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">Linked to task: {title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {history.length > 1 && isEditing && (
                            <button onClick={handleUndo} className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1 transition-colors">
                                <RotateCcw size={14} /> Undo
                            </button>
                        )}
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-1 transition-colors">
                                <Edit2 size={14} /> Edit
                            </button>
                        ) : (
                            <button onClick={handleSave} className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 flex items-center gap-1 transition-colors">
                                <Save size={14} /> Save
                            </button>
                        )}
                        <button onClick={onClose} className="ml-2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-white dark:bg-slate-900">

                    {/* Main Editor/Viewer */}
                    <div className={`flex-1 flex flex-col overflow-y-auto ${isEditing ? 'bg-slate-50 dark:bg-slate-950/50' : 'p-6'}`}>
                        {isEditing ? (
                            <div className="relative flex-1 flex flex-col p-6">
                                {selectedText && (
                                    <div className="absolute top-8 right-8 z-10 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 text-[10px] px-2 py-1 rounded-md font-medium flex items-center gap-1 border border-blue-200 dark:border-blue-800">
                                        <Edit2 size={10} /> Text Selected for AI Edit
                                    </div>
                                )}
                                <textarea
                                    ref={textareaRef}
                                    value={editedContent}
                                    onChange={handleContentChange}
                                    onSelect={handleSelection}
                                    className="flex-1 w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-sm resize-none"
                                    placeholder="Edit content here..."
                                />
                                <div className="mt-2 text-[10px] text-slate-400 italic">
                                    Highlight text to instruct the AI to change only a specific section.
                                </div>
                            </div>
                        ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown remarkPlugins={remarkPlugins}>
                                    {editedContent}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>

                    {/* AI Co-pilot Sidebar (only visible in edit mode) */}
                    {isEditing && (
                        <div className="w-full md:w-80 border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 flex flex-col shrink-0">
                            <div className="flex items-center gap-2 mb-4 text-sm font-bold text-slate-700 dark:text-slate-300">
                                <Bot size={16} className="text-blue-500" /> AI Co-pilot
                            </div>

                            <div className="flex-1 overflow-y-auto mb-4 text-xs text-slate-600 dark:text-slate-400 space-y-4">
                                <p>You can ask me to rewrite, summarize, or expand on the content.</p>

                                {selectedText ? (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50">
                                        <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">Targeting Section:</p>
                                        <p className="italic line-clamp-3 text-slate-500">"{selectedText}"</p>
                                    </div>
                                ) : (
                                    <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Targeting: Entire Document</p>
                                        <p>Highlight text in the editor to target a specific section.</p>
                                    </div>
                                )}
                            </div>

                            <div className="relative mt-auto">
                                <textarea
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleAiEdit();
                                        }
                                    }}
                                    placeholder={selectedText ? "E.g., Make this paragraph more formal..." : "E.g., Summarize this document..."}
                                    className="w-full bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 rounded-xl p-3 pr-10 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none h-24"
                                />
                                <button
                                    onClick={handleAiEdit}
                                    disabled={isAiLoading || !aiPrompt.trim()}
                                    className="absolute bottom-3 right-3 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-between items-center shrink-0">
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigator.clipboard.writeText(editedContent)}
                            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                            Copy to Clipboard
                        </button>
                        <button
                            onClick={handleRegenerateWithPro}
                            disabled={isGeneratingPro}
                            className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/50 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {isGeneratingPro ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
                            Regenerate with 3.1 Pro
                        </button>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={onClose}
                            className="px-5 py-2 text-sm font-medium bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg hover:bg-slate-700 dark:hover:bg-white transition-colors flex items-center gap-2"
                        >
                            <Check size={16} /> Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}