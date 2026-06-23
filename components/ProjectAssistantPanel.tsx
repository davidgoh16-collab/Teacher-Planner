import React, { useState, useEffect, useRef } from 'react';
import { Project, Task, Category } from '../types';
import { X, Send, Bot, User, Loader2, Sparkles, Paperclip } from 'lucide-react';
import { getAiClient, TEXT_MODEL } from '../services/aiService';
import { FunctionDeclaration, Type } from "@google/genai";
import { saveTask, deleteTask } from '../services/projectService';
import { readFileContent } from '../utils/fileUtils';
import ReactMarkdown from 'react-markdown';

interface ProjectAssistantPanelProps {
    project: Project;
    tasks: Task[];
    allCategories: Category[];
    isReadOnly: boolean;
    onClose: () => void;
    onTaskAdded: (task: Task) => void;
    onTaskUpdated: (task: Task) => void;
    onTaskDeleted: (taskId: string) => void;
}

interface Message {
    role: 'user' | 'model';
    text: string;
}

const PRIORITIES: Task['priority'][] = ['High', 'Medium', 'Low'];
const STATUSES: Task['status'][] = ['Uncompleted', 'In Progress', 'Completed'];

export default function ProjectAssistantPanel({ project, tasks, allCategories, isReadOnly, onClose, onTaskAdded, onTaskUpdated, onTaskDeleted }: ProjectAssistantPanelProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Keep a local, always-fresh copy of the project's tasks so the AI sees the
    // latest state after each change it makes.
    const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
    useEffect(() => { setLocalTasks(tasks); }, [tasks]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const isGeneral = project.id.startsWith('__general_');
    const taskCategories = allCategories.filter(c => c.type === 'task');

    // Live project stats for the overview header.
    const totalCount = localTasks.length;
    const completedCount = localTasks.filter(t => t.status === 'Completed').length;
    const inProgressCount = localTasks.filter(t => t.status === 'In Progress').length;
    const todoCount = Math.max(0, totalCount - completedCount - inProgressCount);
    const progressPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
    const projectCategory = allCategories.find(c => c.id === project.categoryId);

    const addTaskDeclaration: FunctionDeclaration = {
        name: "addTask",
        description: "Add one new task to this project.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                priority: { type: Type.STRING, description: "High, Medium, or Low" },
                categoryId: { type: Type.STRING, description: "ID of a matching task category, or omit." },
                scheduledDateStr: { type: Type.STRING, description: "YYYY-MM-DD or omit." },
                deadlineDateStr: { type: Type.STRING, description: "YYYY-MM-DD or omit." },
            },
            required: ["title"]
        }
    };

    const updateTasksDeclaration: FunctionDeclaration = {
        name: "updateTasks",
        description: "Update properties of one or more existing tasks. Do not use this to delete tasks.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                updates: {
                    type: Type.ARRAY,
                    description: "Array of updates. Each MUST include the id of the task plus the fields to change.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: "The ID of the task to update." },
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            priority: { type: Type.STRING, description: "High, Medium, or Low" },
                            status: { type: Type.STRING, description: "Completed, In Progress, or Uncompleted" },
                            categoryId: { type: Type.STRING },
                            scheduledDateStr: { type: Type.STRING, description: "YYYY-MM-DD" },
                            deadlineDateStr: { type: Type.STRING, description: "YYYY-MM-DD" },
                        },
                        required: ["id"]
                    }
                }
            },
            required: ["updates"]
        }
    };

    const deleteTasksDeclaration: FunctionDeclaration = {
        name: "deleteTasks",
        description: "Delete one or more tasks by ID.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                taskIds: { type: Type.ARRAY, description: "Array of task IDs to delete.", items: { type: Type.STRING } }
            },
            required: ["taskIds"]
        }
    };

    const handleSend = async (textToProcess: string) => {
        if ((!textToProcess.trim() && !selectedFile) || isLoading || isReadOnly) return;

        // Read any attached file before we mutate state.
        let fileData: { isBase64: boolean; text: string; mimeType: string } | undefined;
        if (selectedFile) {
            try {
                fileData = await readFileContent(selectedFile);
            } catch (err) {
                console.error("Failed to read file", err);
                setMessages(prev => [...prev, { role: 'model', text: "Sorry, I couldn't read that file." }]);
                return;
            }
        }

        const displayText = textToProcess.trim() || `📎 ${selectedFile?.name}`;
        setMessages(prev => [...prev, { role: 'user', text: displayText }]);
        setInput('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsLoading(true);

        try {
            const ai = getAiClient();
            const todayISO = new Date().toISOString().split('T')[0];

            const categoriesStr = taskCategories.length > 0
                ? `Available task categories: ${taskCategories.map(c => `"${c.name}" (ID: ${c.id})`).join(', ')}.`
                : "There are no task categories defined.";

            const systemInstruction = `
            You are the AI assistant embedded inside a teacher's project called "${project.name}".
            Project description: ${project.description || "(none provided)"}.
            Today's date is ${todayISO}. Use YYYY-MM-DD for any dates and resolve relative dates ("Friday", "next week") against today.

            Here are the project's current tasks (JSON):
            ${JSON.stringify(localTasks.map(t => ({
                id: t.id,
                title: t.title,
                description: t.description || "",
                status: t.status,
                priority: t.priority,
                scheduledDateStr: t.scheduledDateStr || "None",
                deadlineDateStr: t.deadlineDateStr || "None",
                categoryId: t.categoryId || "None",
            })), null, 2)}

            ${categoriesStr}

            You can:
            - Answer questions about the project and its tasks conversationally.
            - 'addTask' to create new tasks (use this for each action item in an attached document).
            - 'updateTasks' to change existing tasks (always reference them by their exact id from the list above).
            - 'deleteTasks' to remove tasks by id.
            priority must be exactly High, Medium, or Low. status must be exactly Completed, In Progress, or Uncompleted.
            Be helpful and concise. Confirm what you changed in plain language.`;

            // Build history from prior turns, dropping the opening greeting so the
            // conversation starts with a user message (required by the chat API).
            const history = messages
                .filter((m, i) => !(i === 0 && m.role === 'model'))
                .map(m => ({ role: m.role, parts: [{ text: m.text }] }));

            const chat = ai.chats.create({
                model: TEXT_MODEL,
                config: {
                    systemInstruction,
                    tools: [{ functionDeclarations: [addTaskDeclaration, updateTasksDeclaration, deleteTasksDeclaration] }]
                },
                history
            });

            // Assemble the message, attaching file content as inline data or text.
            let message: any = textToProcess.trim() || "Please extract the action items from this document and add them as tasks.";
            if (fileData) {
                if (fileData.isBase64) {
                    message = [
                        textToProcess.trim() || "Extract the action items from this document and add them as tasks:",
                        { inlineData: { data: fileData.text, mimeType: fileData.mimeType } }
                    ];
                } else {
                    message = `${textToProcess.trim() || "Extract the action items from this document and add them as tasks."}\n\nDocument content:\n${fileData.text}`;
                }
            }

            const response = await chat.sendMessage({ message });
            let responseText = response.text || "";
            const systemNotes: string[] = [];

            if (response.functionCalls && response.functionCalls.length > 0) {
                let working = [...localTasks];

                for (const call of response.functionCalls) {
                    try {
                        if (call.name === "addTask") {
                            const args = call.args as any;
                            const newTask: Task = {
                                id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                projectId: isGeneral ? '' : project.id,
                                title: args.title,
                                description: args.description || undefined,
                                status: 'Uncompleted',
                                priority: PRIORITIES.includes(args.priority) ? args.priority : 'Medium',
                                categoryId: isGeneral ? project.categoryId : (args.categoryId || undefined),
                                scheduledDateStr: args.scheduledDateStr || undefined,
                                deadlineDateStr: args.deadlineDateStr || undefined,
                                subtasks: [],
                                createdAt: Date.now(),
                            };
                            await saveTask(newTask);
                            working = [newTask, ...working];
                            onTaskAdded(newTask);
                            systemNotes.push(`Added "${newTask.title}".`);
                        } else if (call.name === "updateTasks") {
                            const updates = (call.args?.updates as any[]) || [];
                            for (const update of updates) {
                                const existing = working.find(t => t.id === update.id);
                                if (!existing) continue;
                                const updated: Task = { ...existing };
                                if (typeof update.title === 'string') updated.title = update.title;
                                if (typeof update.description === 'string') updated.description = update.description;
                                if (PRIORITIES.includes(update.priority)) updated.priority = update.priority;
                                if (STATUSES.includes(update.status)) updated.status = update.status;
                                if (typeof update.categoryId === 'string') updated.categoryId = update.categoryId || undefined;
                                if (typeof update.scheduledDateStr === 'string') updated.scheduledDateStr = update.scheduledDateStr || undefined;
                                if (typeof update.deadlineDateStr === 'string') updated.deadlineDateStr = update.deadlineDateStr || undefined;
                                await saveTask(updated);
                                working = working.map(t => t.id === updated.id ? updated : t);
                                onTaskUpdated(updated);
                            }
                            systemNotes.push(`Updated ${updates.length} task${updates.length === 1 ? '' : 's'}.`);
                        } else if (call.name === "deleteTasks") {
                            const ids = (call.args?.taskIds as string[]) || [];
                            for (const id of ids) {
                                await deleteTask(id);
                                onTaskDeleted(id);
                            }
                            working = working.filter(t => !ids.includes(t.id));
                            systemNotes.push(`Deleted ${ids.length} task${ids.length === 1 ? '' : 's'}.`);
                        }
                    } catch (e) {
                        console.error("Error executing", call.name, e);
                        systemNotes.push(`Failed to ${call.name}.`);
                    }
                }

                setLocalTasks(working);
            }

            if (!responseText && systemNotes.length > 0) responseText = "Done.";
            if (systemNotes.length > 0) responseText += `\n\n_${systemNotes.join(' ')}_`;
            if (!responseText) responseText = "I didn't find anything to do there.";

            setMessages(prev => [...prev, { role: 'model', text: responseText }]);
        } catch (e) {
            console.error("Assistant error", e);
            setMessages(prev => [...prev, { role: 'model', text: "Sorry, I ran into an error processing that request." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) setSelectedFile(e.target.files[0]);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(input);
        }
    };

    return (
        <>
            {/* Mobile backdrop */}
            <div onClick={onClose} className="lg:hidden fixed inset-0 bg-black/40 z-30 animate-in fade-in" />

            <aside className="fixed lg:relative inset-y-0 right-0 z-40 w-full max-w-sm lg:max-w-none lg:w-[380px] shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full shadow-2xl lg:shadow-none animate-in slide-in-from-right duration-200">

                {/* Header */}
                <div className="bg-blue-600 px-4 py-3 flex justify-between items-center text-white shrink-0 shadow-md z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-white/20 p-1.5 rounded-lg">
                            <Sparkles size={18} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-bold leading-tight">Project Assistant</h2>
                            <p className="text-[11px] text-blue-100 truncate">{project.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors shrink-0" title="Close assistant">
                        <X size={18} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50">
                    {/* Project overview */}
                    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Overview</h3>
                            {projectCategory && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${projectCategory.colorClass}`}>
                                    {projectCategory.name}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 whitespace-pre-wrap">
                            {project.description?.trim() || <span className="italic opacity-60">No description provided.</span>}
                        </p>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-slate-500 dark:text-slate-400">Progress</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{progressPct}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-2.5 text-[11px] font-medium">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">{totalCount} total</span>
                            <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">{completedCount} done</span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">{inProgressCount} in progress</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">{todoCount} to do</span>
                        </div>
                    </div>

                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                            <div className={`max-w-[88%] rounded-2xl p-3 shadow-sm flex gap-2.5 ${
                                msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'
                            }`}>
                                <div className="shrink-0 mt-0.5">
                                    {msg.role === 'user' ? <User size={15} className="text-blue-100" /> : <Bot size={15} className="text-blue-500" />}
                                </div>
                                {msg.role === 'user' ? (
                                    <div className="text-sm leading-relaxed whitespace-pre-wrap flex-1 min-w-0">{msg.text}</div>
                                ) : (
                                    <div className="text-sm leading-relaxed flex-1 min-w-0 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-none p-3 shadow-sm flex gap-2.5 items-center">
                                <Bot size={15} className="text-blue-500 shrink-0" />
                                <Loader2 size={15} className="animate-spin text-slate-400" />
                                <span className="text-sm text-slate-500">Thinking…</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
                    {selectedFile && (
                        <div className="mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-medium truncate">
                                <Paperclip size={13} /> {selectedFile.name}
                            </span>
                            <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 p-0.5 shrink-0">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
                        className="flex items-end gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-blue-500 border border-transparent dark:border-slate-700"
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.docx,.txt,image/*" />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading || isReadOnly}
                            title="Attach a document"
                            className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 shrink-0"
                        >
                            <Paperclip size={18} />
                        </button>
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            rows={1}
                            placeholder={isReadOnly ? "Read-only mode" : "Ask or tell me what to do…"}
                            disabled={isLoading || isReadOnly}
                            className="flex-1 bg-transparent px-1 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none disabled:opacity-50 resize-none max-h-28"
                        />
                        <button
                            type="submit"
                            disabled={(!input.trim() && !selectedFile) || isLoading || isReadOnly}
                            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors shadow-sm shrink-0"
                        >
                            <Send size={16} />
                        </button>
                    </form>
                    <p className="text-[10px] text-slate-400 text-center mt-1.5">AI can make mistakes. Please verify changes.</p>
                </div>
            </aside>
        </>
    );
}
