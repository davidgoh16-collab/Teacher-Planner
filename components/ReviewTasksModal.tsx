import React, { useState, useEffect, useRef } from 'react';
import { Task } from '../types';
import { X, Send, Bot, User, Loader2, Sparkles, CheckSquare, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getAiClient, TEXT_MODEL } from '../services/aiService';
import { FunctionDeclaration, Type } from "@google/genai";
import { saveTask, deleteTask } from '../services/projectService';

interface ReviewTasksModalProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    actionType?: 'delete_tasks' | 'group_tasks' | 'review_tasks' | 'update_tasks' | 'generic';
    initialPrompt?: string;
    onTasksUpdated?: () => void;
    isReadOnly: boolean;
}

interface Message {
    role: 'user' | 'model';
    text: string;
}

export default function ReviewTasksModal({ isOpen, onClose, tasks, actionType = 'generic', initialPrompt, onTasksUpdated, isReadOnly }: ReviewTasksModalProps) {
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    const [isExecuting, setIsExecuting] = useState(false);

    // Chat Mode State
    const [isChatMode, setIsChatMode] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Keep a local copy of tasks so we can reflect changes immediately without waiting for parent refresh
    const [localTasks, setLocalTasks] = useState<Task[]>([]);

    useEffect(() => {
        // Only reset local tasks if the length or IDs change to prevent overwriting during edits
        const taskIds = tasks.map(t => t.id).join(',');
        const localTaskIds = localTasks.map(t => t.id).join(',');

        if (taskIds !== localTaskIds) {
            setLocalTasks(tasks);
        }
    }, [tasks, localTasks]);

    useEffect(() => {
        if (isOpen) {
            setIsChatMode(false);
            setMessages([]);
            setInput('');
            // By default, select all tasks for review when modal opens
            setSelectedTaskIds(new Set(tasks.map(t => t.id)));
        }
    }, [isOpen]);

    useEffect(() => {
        if (isChatMode) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isChatMode]);

    const handleToggleTask = (taskId: string) => {
        const newSet = new Set(selectedTaskIds);
        if (newSet.has(taskId)) {
            newSet.delete(taskId);
        } else {
            newSet.add(taskId);
        }
        setSelectedTaskIds(newSet);
    };

    const handleExecuteAction = async () => {
        if (selectedTaskIds.size === 0 || isReadOnly) return;
        setIsExecuting(true);

        try {
            if (actionType === 'delete_tasks') {
                for (const id of selectedTaskIds) {
                    await deleteTask(id);
                }
                setLocalTasks(prev => prev.filter(t => !selectedTaskIds.has(t.id)));
                setSelectedTaskIds(new Set());
                if (onTasksUpdated) onTasksUpdated();
            } else if (actionType === 'review_tasks') {
                // For review, "actioning" usually means marking them as complete
                for (const id of selectedTaskIds) {
                    const task = localTasks.find(t => t.id === id);
                    if (task) {
                        await saveTask({ ...task, status: 'Completed' });
                    }
                }
                setLocalTasks(prev => prev.map(t => selectedTaskIds.has(t.id) ? { ...t, status: 'Completed' } : t));
                if (onTasksUpdated) onTasksUpdated();
            } else if (actionType === 'group_tasks' || actionType === 'update_tasks' || actionType === 'generic') {
                 // For complex AI actions, fallback to asking the AI to perform the action based on the prompt
                 if (initialPrompt) {
                     await handleSendChat(initialPrompt, true);
                     setIsChatMode(true); // Switch to chat to show what happened
                 } else {
                     setIsChatMode(true);
                     setMessages([{ role: 'model', text: "What would you like to do with these selected tasks?" }]);
                 }
            }
        } catch (e) {
            console.error("Failed to execute action", e);
            alert("Failed to execute action.");
        } finally {
            setIsExecuting(false);
            if (actionType === 'delete_tasks' || actionType === 'review_tasks') {
                // Give a little visual feedback then close if all were processed
                setTimeout(() => {
                    if (selectedTaskIds.size === 0) {
                       // onClose(); // Let user decide when to close
                    }
                }, 500);
            }
        }
    };

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

    const handleSendChat = async (textToProcess: string, silentInput = false) => {
        if (!textToProcess.trim() || isReadOnly) return;

        if (!silentInput) {
            const userMsg: Message = { role: 'user', text: textToProcess };
            setMessages(prev => [...prev, userMsg]);
            setInput('');
        }
        setIsChatLoading(true);

        // Only send tasks that are currently selected by the user to the AI for context
        const contextTasks = localTasks.filter(t => selectedTaskIds.has(t.id));

        try {
            const ai = getAiClient();

            const systemInstruction = `
            You are an AI assistant helping a teacher manage a specific list of tasks.
            The user has selected ${contextTasks.length} tasks to act upon.

            Here are the currently selected tasks (JSON format):
            ${JSON.stringify(contextTasks.map(t => ({
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

            const history = messages.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            const chat = ai.chats.create({
                    model: TEXT_MODEL,
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

                                // Clean up selection
                                const newSelection = new Set(selectedTaskIds);
                                taskIds.forEach(id => newSelection.delete(id));
                                setSelectedTaskIds(newSelection);

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
                    if (onTasksUpdated) onTasksUpdated();
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
            setIsChatLoading(false);
        }
    };

    if (!isOpen) return null;

    const renderActionButtons = () => {
        if (selectedTaskIds.size === 0) return null;

        switch (actionType) {
            case 'delete_tasks':
                return (
                    <button
                        onClick={handleExecuteAction}
                        disabled={isExecuting}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        {isExecuting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        Delete Selected ({selectedTaskIds.size})
                    </button>
                );
            case 'review_tasks':
                return (
                    <button
                        onClick={handleExecuteAction}
                        disabled={isExecuting}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        {isExecuting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                        Mark Selected Complete ({selectedTaskIds.size})
                    </button>
                );
            case 'group_tasks':
                return (
                    <button
                        onClick={handleExecuteAction}
                        disabled={isExecuting}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        {isExecuting ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                        Auto-Group Selected ({selectedTaskIds.size})
                    </button>
                );
            case 'update_tasks':
            case 'generic':
            default:
                return (
                    <button
                        onClick={handleExecuteAction}
                        disabled={isExecuting}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        {isExecuting ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                        Apply AI Update ({selectedTaskIds.size})
                    </button>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-slate-100 dark:bg-slate-800 p-4 flex justify-between items-center shrink-0 border-b border-slate-200 dark:border-slate-700 z-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg">
                            <CheckSquare size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                Review Tasks
                                <span className="text-slate-500 text-sm font-normal">| {localTasks.length} tasks</span>
                            </h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden">

                    {/* List View Area (Always visible, shrinks on md screens if chat is open) */}
                    <div className={`flex flex-col h-full ${isChatMode ? 'hidden md:flex md:w-1/2 border-r border-slate-200 dark:border-slate-700' : 'w-full'} bg-slate-50 dark:bg-slate-900/50`}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                Select tasks to action
                            </h3>
                            <button
                                onClick={() => {
                                    if (selectedTaskIds.size === localTasks.length) {
                                        setSelectedTaskIds(new Set());
                                    } else {
                                        setSelectedTaskIds(new Set(localTasks.map(t => t.id)));
                                    }
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium"
                            >
                                {selectedTaskIds.size === localTasks.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            {localTasks.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => handleToggleTask(t.id)}
                                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                        selectedTaskIds.has(t.id)
                                            ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800'
                                            : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-slate-800 dark:border-slate-700'
                                    }`}
                                >
                                    <div className="mt-0.5">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                                            selectedTaskIds.has(t.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 dark:border-slate-600'
                                        }`}>
                                            {selectedTaskIds.has(t.id) && <CheckSquare size={14} />}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                t.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                t.priority === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            }`}>
                                                {t.priority}
                                            </span>
                                            {t.status === 'Completed' && (
                                                <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-full flex items-center gap-1 font-medium">
                                                    <CheckCircle2 size={10} /> Completed
                                                </span>
                                            )}
                                        </div>
                                        <h4 className={`text-sm font-semibold truncate ${selectedTaskIds.has(t.id) ? 'text-blue-900 dark:text-blue-100' : 'text-slate-800 dark:text-slate-200'} ${t.status === 'Completed' ? 'line-through opacity-60' : ''}`}>
                                            {t.title}
                                        </h4>
                                        {t.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                                                {t.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {localTasks.length === 0 && (
                                <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                                    <AlertCircle size={32} className="mb-2 text-slate-400" />
                                    <p>No tasks to review.</p>
                                </div>
                            )}
                        </div>

                        {/* Actions Footer */}
                        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                {renderActionButtons()}
                            </div>

                            {!isChatMode && (
                                <button
                                    onClick={() => setIsChatMode(true)}
                                    disabled={selectedTaskIds.size === 0}
                                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg font-medium transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                                >
                                    <Sparkles size={18} className="text-blue-500" />
                                    Ask AI...
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Chat Area (Visible when isChatMode is true) */}
                    {isChatMode && (
                        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 relative border-l border-slate-200 dark:border-slate-800">
                            {/* Mobile Chat Header (to go back to list) */}
                            <div className="md:hidden p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                                <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Ask AI</span>
                                <button onClick={() => setIsChatMode(false)} className="text-blue-600 text-sm font-medium">
                                    Back to List
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/30">
                                {messages.length === 0 && (
                                    <div className="text-center mt-8 space-y-4 text-slate-500">
                                        <Bot size={40} className="mx-auto text-blue-300 dark:text-blue-700" />
                                        <p>I can help you manage the {selectedTaskIds.size} selected tasks.</p>
                                        <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto">
                                            <button onClick={() => handleSendChat("Which of these is the most urgent?")} className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700">"Which is most urgent?"</button>
                                            <button onClick={() => handleSendChat("Mark them all as high priority")} className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700">"Make them High Priority"</button>
                                        </div>
                                    </div>
                                )}
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
                                {isChatLoading && (
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
                                    onSubmit={(e) => { e.preventDefault(); handleSendChat(input); }}
                                    className="relative flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 shadow-inner border border-transparent dark:border-slate-700"
                                >
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        placeholder={isReadOnly ? "Read-only mode" : `Ask AI about ${selectedTaskIds.size} tasks...`}
                                        disabled={isChatLoading || isReadOnly || selectedTaskIds.size === 0}
                                        className="w-full bg-transparent px-4 py-3 text-slate-900 dark:text-white focus:outline-none disabled:opacity-50 text-sm"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || isChatLoading || isReadOnly || selectedTaskIds.size === 0}
                                        className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors shadow-sm"
                                    >
                                        <Send size={16} className={input.trim() && !isChatLoading ? 'translate-x-0.5' : ''} />
                                    </button>
                                </form>
                                <div className="text-center mt-2 flex justify-between items-center px-1">
                                    <span className="text-[10px] text-slate-400">Context: {selectedTaskIds.size} tasks selected</span>
                                    <span className="text-[10px] text-slate-400">AI can make mistakes. Verify changes.</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}