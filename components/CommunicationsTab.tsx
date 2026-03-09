import React, { useState, useEffect } from 'react';
import {
    Mail, MessageSquare, FileText, Send, UserCircle, Users, Megaphone,
    Copy, Check, Trash2, Clock, Loader2, Sparkles, User, RefreshCw, Paperclip, X
} from 'lucide-react';
import { generateContentFromAction } from '../services/aiService';
import { fetchCommunicationMessages, saveCommunicationMessage, deleteCommunicationMessage } from '../services/projectService';
import { CommunicationMessage } from '../types';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Props {
    isReadOnly: boolean;
}

const CommunicationsTab: React.FC<Props> = ({ isReadOnly }) => {
    // Form State
    const [type, setType] = useState<'email' | 'message' | 'letter'>('email');
    const [audience, setAudience] = useState<'parent' | 'staff' | 'announcement'>('parent');
    const [recipient, setRecipient] = useState('');
    const [replyToText, setReplyToText] = useState('');
    const [instructions, setInstructions] = useState('');

    // UI State
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedText, setGeneratedText] = useState('');
    const [copied, setCopied] = useState(false);

    // File Upload State
    const [attachedFiles, setAttachedFiles] = useState<{name: string, content: string}[]>([]);
    const [isParsingFiles, setIsParsingFiles] = useState(false);

    // History State
    const [history, setHistory] = useState<CommunicationMessage[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsParsingFiles(true);
        const newFiles: {name: string, content: string}[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileName = file.name.toLowerCase();

                if (fileName.endsWith('.txt')) {
                    const text = await file.text();
                    newFiles.push({ name: file.name, content: text });
                } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
                    const arrayBuffer = await file.arrayBuffer();
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    newFiles.push({ name: file.name, content: result.value });
                } else if (fileName.endsWith('.pdf')) {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    let fullText = '';
                    for (let j = 1; j <= pdf.numPages; j++) {
                        const page = await pdf.getPage(j);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map((item: any) => item.str).join(' ');
                        fullText += pageText + '\n';
                    }
                    newFiles.push({ name: file.name, content: fullText });
                }
            }

            setAttachedFiles(prev => [...prev, ...newFiles]);
        } catch (error) {
            console.error("Error parsing files:", error);
            // Optionally could add a toast here
        } finally {
            setIsParsingFiles(false);
            // Reset input so the same file can be selected again if needed
            event.target.value = '';
        }
    };

    const removeFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const loadHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const messages = await fetchCommunicationMessages();
            setHistory(messages);
        } catch (error) {
            console.error("Failed to load history", error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleGenerate = async () => {
        if (!instructions.trim() || !recipient.trim()) return;

        setIsGenerating(true);
        setGeneratedText('');

        try {
            let toneInstructions = '';
            if (audience === 'parent') toneInstructions = 'formal, respectful, and clear.';
            else if (audience === 'staff') toneInstructions = 'professional but friendly and collaborative.';
            else if (audience === 'announcement') toneInstructions = 'straight forward, informative, and concise.';

            let formatInstructions = '';
            if (type === 'email') formatInstructions = 'Include a subject line, a proper greeting, and sign off as "Mr D Goh".';
            else if (type === 'message') formatInstructions = 'Keep it short and suitable for a direct message or text. Sign off as "Mr D Goh".';
            else if (type === 'letter') formatInstructions = 'Format as a formal letter with date, recipient address placeholder, formal greeting, and sign off as "Mr D Goh".';

            let prompt = `You are an AI assistant drafting a communication for a teacher.\n\n`;
            prompt += `Draft a ${type} to: ${recipient}\n`;
            prompt += `Audience: ${audience}. The tone should be ${toneInstructions}\n`;
            prompt += `Format Requirements: ${formatInstructions}\n\n`;

            if (replyToText.trim()) {
                prompt += `This is a reply to the following message:\n"""\n${replyToText}\n"""\n\n`;
            }

            if (attachedFiles.length > 0) {
                prompt += `Here are some context files provided by the user. Use them as context to write the message:\n\n`;
                attachedFiles.forEach(file => {
                    prompt += `--- Start of file: ${file.name} ---\n`;
                    prompt += `${file.content}\n`;
                    prompt += `--- End of file: ${file.name} ---\n\n`;
                });
            }

            prompt += `Instructions for what to say:\n${instructions}\n\n`;
            prompt += `Write the draft now. Do not include introductory conversational text, just provide the draft.`;

            const result = await generateContentFromAction(prompt);
            setGeneratedText(result.trim());

            // Auto-save to history
            if (!isReadOnly) {
                const newMessage: CommunicationMessage = {
                    id: `msg_${Date.now()}`,
                    type,
                    audience,
                    recipient,
                    replyToText: replyToText || undefined,
                    instructions,
                    generatedContent: result.trim(),
                    createdAt: Date.now()
                };

                await saveCommunicationMessage(newMessage);
                setHistory(prev => [newMessage, ...prev]);
            }

        } catch (error) {
            console.error("Failed to generate draft", error);
            setGeneratedText("Sorry, an error occurred while generating the draft. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDeleteHistory = async (id: string) => {
        if (isReadOnly) return;
        try {
            await deleteCommunicationMessage(id);
            setHistory(prev => prev.filter(m => m.id !== id));
        } catch (error) {
            console.error("Failed to delete message", error);
        }
    };

    const loadFromHistory = (msg: CommunicationMessage) => {
        setType(msg.type);
        setAudience(msg.audience);
        setRecipient(msg.recipient);
        setReplyToText(msg.replyToText || '');
        setInstructions(msg.instructions);
        setGeneratedText(msg.generatedContent);
        setAttachedFiles([]); // Clear attached files when loading history
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* Main Form Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
                <div className="w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col lg:flex-row flex-1">

                    {/* Input Column */}
                    <div className="flex-1 p-6 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-1">
                                <Sparkles className="text-green-600 dark:text-green-400" size={20} />
                                AI Communications Draft
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Generate emails, messages, and letters with the right tone.</p>
                        </div>

                        {/* Format & Audience Toggles */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Format</label>
                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg overflow-x-auto no-scrollbar">
                                    {[
                                        { id: 'email', icon: <Mail size={16} className="shrink-0" />, label: 'Email' },
                                        { id: 'message', icon: <MessageSquare size={16} className="shrink-0" />, label: 'Message' },
                                        { id: 'letter', icon: <FileText size={16} className="shrink-0" />, label: 'Letter' }
                                    ].map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setType(t.id as any)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${type === t.id ? 'bg-white dark:bg-slate-800 text-green-700 dark:text-green-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                        >
                                            {t.icon} <span className="hidden sm:inline">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Audience (Tone)</label>
                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg overflow-x-auto no-scrollbar">
                                    {[
                                        { id: 'parent', icon: <UserCircle size={16} className="shrink-0" />, label: 'Parent' },
                                        { id: 'staff', icon: <Users size={16} className="shrink-0" />, label: 'Staff' },
                                        { id: 'announcement', icon: <Megaphone size={16} className="shrink-0" />, label: 'Announcement' }
                                    ].map(a => (
                                        <button
                                            key={a.id}
                                            onClick={() => setAudience(a.id as any)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${audience === a.id ? 'bg-white dark:bg-slate-800 text-green-700 dark:text-green-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                        >
                                            {a.icon} <span className="hidden sm:inline">{a.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Recipient */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <User size={16} className="text-slate-400" /> To (Recipient)
                            </label>
                            <input
                                type="text"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder="e.g., Mr. and Mrs. Smith, or All Staff"
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                            />
                        </div>

                        {/* Replying To */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                <span>Message Replying To <span className="text-slate-400 font-normal text-xs">(Optional)</span></span>
                            </label>
                            <textarea
                                value={replyToText}
                                onChange={(e) => setReplyToText(e.target.value)}
                                placeholder="Paste the email or message you are replying to here..."
                                rows={3}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm resize-none"
                            />
                        </div>

                        {/* Instructions */}
                        <div className="space-y-1.5 flex-1 flex flex-col">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Instructions / Main Points <span className="text-red-500">*</span>
                            </label>
                            <div className="flex-1 relative min-h-[120px]">
                                <textarea
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    placeholder="What do you want to say? e.g., 'Remind them about the parents evening next Tuesday and ask them to book a slot online.'"
                                    className="absolute inset-0 w-full h-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors text-sm resize-none"
                                />
                            </div>

                            {/* Attached Files List */}
                            {attachedFiles.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {attachedFiles.map((file, i) => (
                                        <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                                            <Paperclip size={12} className="text-slate-400" />
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[150px] truncate" title={file.name}>{file.name}</span>
                                            <button
                                                onClick={() => removeFile(i)}
                                                className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Attach File Button */}
                            <div className="mt-2 flex justify-start">
                                <label className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors border ${isParsingFiles ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white'}`}>
                                    {isParsingFiles ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                                    {isParsingFiles ? 'Reading...' : 'Attach Context Files'}
                                    <input
                                        type="file"
                                        multiple
                                        accept=".pdf,.doc,.docx,.txt"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={isParsingFiles}
                                    />
                                </label>
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !instructions.trim() || !recipient.trim()}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.98]"
                        >
                            {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                            {isGenerating ? 'Generating...' : 'Generate Draft'}
                        </button>
                    </div>

                    {/* Output Column */}
                    <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-6 flex flex-col min-h-[400px] lg:border-l border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <FileText className="text-slate-400" size={18} /> Generated Output
                            </h3>
                            {generatedText && (
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors shadow-sm"
                                >
                                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                    {copied ? 'Copied!' : 'Copy Text'}
                                </button>
                            )}
                        </div>

                        {generatedText ? (
                            <div className="flex-1 relative">
                                <textarea
                                    value={generatedText}
                                    onChange={(e) => setGeneratedText(e.target.value)}
                                    className="absolute inset-0 w-full h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-slate-800 dark:text-slate-200 text-sm font-medium focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors resize-y shadow-inner"
                                />
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-white/50 dark:bg-slate-900/50">
                                <Sparkles size={48} className="mb-4 opacity-20" />
                                <p className="text-center text-sm font-medium px-8">Fill out the form and click "Generate Draft" to create a professionally toned message signed by Mr D Goh.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* History Sidebar */}
            <div className="w-80 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 hidden lg:flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Clock size={18} className="text-green-600 dark:text-green-400" />
                        History
                    </h3>
                    <button onClick={loadHistory} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" title="Refresh history">
                        <RefreshCw size={14} className={isLoadingHistory ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {isLoadingHistory ? (
                         <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>
                    ) : history.length === 0 ? (
                        <div className="py-10 text-center text-sm text-slate-400">No saved messages yet.</div>
                    ) : (
                        history.map((msg) => (
                            <div key={msg.id} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 hover:shadow-md transition-shadow group relative cursor-pointer" onClick={() => loadFromHistory(msg)}>
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {msg.type === 'email' && <Mail size={14} className="text-blue-500" />}
                                        {msg.type === 'message' && <MessageSquare size={14} className="text-green-500" />}
                                        {msg.type === 'letter' && <FileText size={14} className="text-amber-500" />}
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{msg.type}</span>
                                    </div>
                                    {!isReadOnly && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteHistory(msg.id); }}
                                            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white mb-1">To: {msg.recipient}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{msg.instructions}</p>
                                <div className="mt-2 text-[10px] text-slate-400 font-medium">
                                    {new Date(msg.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommunicationsTab;