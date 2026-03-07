import React, { useState, useEffect, useRef } from 'react';
import { Task } from '../types';
import { X, Send, Bot, User, Loader2, Sparkles, CheckSquare } from 'lucide-react';
import { getAiClient } from '../services/aiService';
import { FunctionDeclaration, Type } from "@google/genai";
import { saveTask, deleteTask } from '../services/projectService';

interface BulkTaskAIModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    initialPrompt?: string;
    onTasksUpdated: () => void;
    isReadOnly: boolean;
}

interface Message {
    role: 'user' | 'model';
    text: string;
}

export default function BulkTaskAIModal({ isOpen, onClose, tasks, initialPrompt, onTasksUpdated, isReadOnly }: BulkTaskAIModalProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Keep a local copy of tasks that gets updated when AI changes them, so the AI has fresh context.
    const [localTasks, setLocalTasks] = useState<Task[]>([]);

    useEffect(() => {
        setLocalTasks(tasks);
    }, [tasks]);

    useEffect(() => {
        if (isOpen) {
            setMessages([]);
            setInput('');
            if (initialPrompt) {
                handleSend(initialPrompt);
            } else {
                setMessages([{ role: 'model', text: `Hi! I'm ready to help you manage these ${tasks.length} tasks. What would you like to do? (e.g. "Change all due dates to Friday", "Mark tasks with 'meeting' as complete", "Delete tasks named 'test'")` }]);
            }
        }
    }, [isOpen, initialPrompt]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const updateTasksDeclaration: FunctionDeclaration = {
        name: "updateTasks",
        description: "Updates properties of one or more existing tasks. Do not use this to delete tasks.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                updates: {
                    type: Type.ARRAY,
                    description: "Array of task update objects. Each object MUST contain the id of the task to update, plus the fields to change.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: "The ID of the task to update." },
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            priority: { type: Type.STRING, description: "Must be High, Medium, or Low" },
                            status: { type: Type.STRING, description: "Must be Completed, In Progress, or Uncompleted" },
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
        description: "Deletes one or more tasks by ID.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                taskIds: {
                    type: Type.ARRAY,
                    description: "Array of task IDs to delete.",
                    items: {
                        type: Type.STRING
                    }
                }
            },
            required: ["taskIds"]
        }
    };

    const handleSend = async (textToProcess: string) => {
        if (!textToProcess.trim() || isReadOnly) return;

        const userMsg: Message = { role: 'user', text: textToProcess };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const ai = getAiClient();

            // Build the system prompt with the current context of tasks
            const systemInstruction = `
            You are an AI assistant helping a teacher manage a specific list of tasks.
            The user has selected ${localTasks.length} tasks to act upon.

            Here are the currently selected tasks (JSON format):
            ${JSON.stringify(localTasks.map(t => ({
                id: t.id,
                title: t.title,
                description: t.description || "",
                status: t.status,
                priority: t.priority,
                scheduledDateStr: t.scheduledDateStr || "None",
                deadlineDateStr: t.deadlineDateStr || "None"
            })), null, 2)}

            You have access to tools to 'updateTasks' and 'deleteTasks'.
            When the user asks you to modify or delete tasks, use the appropriate tool.
            If the user asks a question about the tasks, answer it normally.
            Be helpful and concise.
            `;

            // Prepare history
            const history = messages.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            const chat = ai.chats.create({
                model: "gemini-3.1-flash-lite-preview",
                config: {
                    systemInstruction: systemInstruction,
                    tools: [{ functionDeclarations: [updateTasksDeclaration, deleteTasksDeclaration] }]
                },
                history: history
            });

            const response = await chat.sendMessage({ message: textToProcess });
            let responseText = response.text || "";
            let dataChanged = false;

            if (response.functionCalls && response.functionCalls.length > 0) {
                for (const call of response.functionCalls) {
                    try {
                        if (call.name === "updateTasks") {
                            const updates = call.args?.updates as any[];
                            if (updates && Array.isArray(updates)) {
                                let updatedTasksList = [...localTasks];
                                for (const update of updates) {
                                    const task = updatedTasksList.find(t => t.id === update.id);
                                    if (task) {
                                        const updatedTask = { ...task, ...update };
                                        await saveTask(updatedTask);
                                        updatedTasksList = updatedTasksList.map(t => t.id === task.id ? updatedTask : t);
                                    }
                                }
                                setLocalTasks(updatedTasksList);
                                dataChanged = true;
                                responseText += `\n*(System: Successfully updated ${updates.length} tasks)*`;
                            }
                        } else if (call.name === "deleteTasks") {
                            const taskIds = call.args?.taskIds as string[];
                            if (taskIds && Array.isArray(taskIds)) {
                                for (const id of taskIds) {
                                    await deleteTask(id);
                                }
                                setLocalTasks(prev => prev.filter(t => !taskIds.includes(t.id)));
                                dataChanged = true;
                                responseText += `\n*(System: Successfully deleted ${taskIds.length} tasks)*`;
                            }
                        }
                    } catch (e) {
                        console.error("Error executing function call", e);
                        responseText += `\n*(System Error: Failed to execute ${call.name})*`;
                    }
                }

                if (dataChanged) {
                    onTasksUpdated();
                }
            }

            if (!responseText && dataChanged) {
                 responseText = "I have made the requested changes.";
            }

            if (responseText) {
                 setMessages(prev => [...prev, { role: 'model', text: responseText }]);
            }

        } catch (e) {
            console.error("AI chat error", e);
            setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error while processing that request." }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-blue-600 p-4 flex justify-between items-center text-white shrink-0 shadow-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Sparkles size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold flex items-center gap-2">Ask AI <span className="text-blue-200 text-sm font-normal">| {localTasks.length} selected tasks</span></h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Tasks Context Sidebar (Optional visual reference) */}
                    <div className="hidden md:block w-1/3 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-4 custom-scrollbar">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <CheckSquare size={14} /> Selected Tasks ({localTasks.length})
                        </h3>
                        <div className="space-y-2">
                            {localTasks.map(t => (
                                <div key={t.id} className="text-sm bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 shadow-sm truncate">
                                    {t.title}
                                </div>
                            ))}
                            {localTasks.length === 0 && (
                                <p className="text-sm text-slate-500 italic">No tasks remaining.</p>
                            )}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 relative">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm flex gap-3 ${
                                        msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-br-none'
                                            : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'
                                    }`}>
                                        <div className="shrink-0 mt-0.5">
                                            {msg.role === 'user' ? <User size={16} className="text-blue-100" /> : <Bot size={16} className="text-blue-500" />}
                                        </div>
                                        <div className="text-sm leading-relaxed whitespace-pre-wrap flex-1 min-w-0">
                                            {msg.text}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-none p-4 shadow-sm flex gap-3 items-center">
                                        <Bot size={16} className="text-blue-500 shrink-0" />
                                        <Loader2 size={16} className="animate-spin text-slate-400" />
                                        <span className="text-sm text-slate-500">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
                                className="relative flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 shadow-inner border border-transparent dark:border-slate-700"
                            >
                                <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    placeholder={isReadOnly ? "Read-only mode" : "Tell me what to do with these tasks..."}
                                    disabled={isLoading || isReadOnly || localTasks.length === 0}
                                    className="w-full bg-transparent px-4 py-3 text-slate-900 dark:text-white focus:outline-none disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading || isReadOnly || localTasks.length === 0}
                                    className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors shadow-sm"
                                >
                                    <Send size={16} className={input.trim() && !isLoading ? 'translate-x-0.5' : ''} />
                                </button>
                            </form>
                            <div className="text-center mt-2">
                                <p className="text-[10px] text-slate-400">AI can make mistakes. Please verify changes.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}