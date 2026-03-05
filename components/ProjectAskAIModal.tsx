import React, { useState, useRef } from 'react';
import { X, Bot, Paperclip, Loader2, Send } from 'lucide-react';
import { Project, Task } from '../types';
import { extractTaskDetails, getAiClient } from '../services/aiService';
import { readFileContent } from '../utils/fileUtils';
import { saveTask } from '../services/projectService';
import { Type, FunctionDeclaration, Chat } from "@google/genai";
import ReactMarkdown from 'react-markdown';

interface ProjectAskAIModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onTaskAdded: (task: Task) => void;
    isReadOnly: boolean;
}

const ProjectAskAIModal: React.FC<ProjectAskAIModalProps> = ({ isOpen, onClose, project, onTaskAdded, isReadOnly }) => {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Simple state to show AI responses or extracted task confirmation
    const [aiResponse, setAiResponse] = useState<string>('');

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleExtract = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && !selectedFile) || isLoading || isReadOnly) return;

        setIsLoading(true);
        setAiResponse('');

        let fileData;
        if (selectedFile) {
            try {
                fileData = await readFileContent(selectedFile);
            } catch (err) {
                console.error("Failed to read file", err);
                setAiResponse("Failed to read the attached file.");
                setIsLoading(false);
                return;
            }
        }

        try {
            const ai = getAiClient();

            const addTaskTool: FunctionDeclaration = {
                name: 'addTask',
                description: 'Extract and add a task to the current project.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                    },
                    required: ['title']
                }
            };

            const systemInstruction = `You are a project assistant for the project "${project.name}".
            Your job is to read the user's input or uploaded document, extract any action items or tasks, and call the 'addTask' tool for EACH one you find.
            Be thorough. If the user asks a general question, you can just answer it instead.`;

            const chat: Chat = ai.chats.create({
                model: 'gemini-3.1-flash-lite-preview',
                config: {
                    systemInstruction: systemInstruction,
                    tools: [{ functionDeclarations: [addTaskTool] }]
                }
            });

            let finalMessage: any = input || "Please extract action items from this document.";
            if (fileData) {
                if (fileData.isBase64) {
                    finalMessage = [
                        input || "Extract actions from this document:",
                        { inlineData: { data: fileData.text, mimeType: fileData.mimeType } }
                    ];
                } else {
                    finalMessage = `User Request: ${input || "Extract actions"}\n\nDocument Content:\n${fileData.text}`;
                }
            }

            const response = await chat.sendMessage({ message: finalMessage });
            const functionCalls = response.functionCalls;
            let finalText = response.text || "";
            let tasksAdded = 0;

            if (functionCalls && functionCalls.length > 0) {
                for (const call of functionCalls) {
                    if (call.name === 'addTask') {
                        const args = call.args as any;
                        const newTask: Task = {
                            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            projectId: project.id,
                            title: args.title,
                            description: args.description || undefined,
                            priority: args.priority || 'Medium',
                            status: 'Uncompleted',
                            subtasks: []
                        };

                        try {
                            await saveTask(newTask);
                            onTaskAdded(newTask);
                            tasksAdded++;
                        } catch (e) {
                            console.error("Failed to save task", e);
                        }
                    }
                }

                finalText = `I have successfully extracted and added ${tasksAdded} tasks to this project.\n\n` + finalText;
            }

            if (tasksAdded === 0 && !functionCalls?.length && !finalText) {
                 finalText = "I didn't find any clear action items to extract.";
            }

            setAiResponse(finalText);

        } catch (error) {
            console.error("AI Error:", error);
            setAiResponse("An error occurred while connecting to the AI.");
        } finally {
            setIsLoading(false);
            setInput('');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Bot className="text-blue-500" />
                        Ask AI & Extract Actions
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Upload a document (PDF, DOCX, TXT) or paste text to automatically extract action items and add them as tasks to <strong>{project.name}</strong>.
                    </p>

                    <form onSubmit={handleExtract} className="space-y-3">
                         {selectedFile && (
                            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-medium truncate">
                                    <Paperclip size={14} /> {selectedFile.name}
                                </span>
                                <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 p-1">
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type a request, paste notes, or upload a file..."
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y text-slate-900 dark:text-white"
                            disabled={isLoading}
                        />

                        <div className="flex justify-between items-center">
                            <div>
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
                                    className="text-sm font-medium text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                    <Paperclip size={16} /> Attach Document
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={(!input.trim() && !selectedFile) || isLoading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                {isLoading ? 'Processing...' : 'Ask / Extract'}
                            </button>
                        </div>
                    </form>

                    {aiResponse && (
                        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 animate-in fade-in">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Bot size={12} /> AI Response
                            </h4>
                            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                <ReactMarkdown>{aiResponse}</ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectAskAIModal;