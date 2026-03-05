import React, { useState, useEffect } from 'react';
import { generateInsights, AIInsight, generateContentFromAction } from '../services/aiService';
import { Sparkles, X, Check, Loader2, Bot, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { Task, Project } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { saveTask } from '../services/projectService';

interface AIInsightsPanelProps {
    contextType: 'project' | 'all_tasks';
    tasks: Task[];
    project?: Project;
    isReadOnly: boolean;
    onTaskUpdate: () => void;
}

export default function AIInsightsPanel({ contextType, tasks, project, isReadOnly, onTaskUpdate }: AIInsightsPanelProps) {
    const [insights, setInsights] = useState<AIInsight[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    // Content Generation Modal State
    const [generatingAction, setGeneratingAction] = useState<AIInsight | null>(null);
    const [generatedContent, setGeneratedContent] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratedModalOpen, setIsGeneratedModalOpen] = useState(false);

    useEffect(() => {
        // Automatically fetch insights on load
        if (!isReadOnly && tasks.length > 0 && !isDismissed) {
            loadInsights();
        }
    }, [contextType, project?.id]); // Refetch if project changes or context changes

    const loadInsights = async () => {
        setIsLoading(true);
        try {
            const fetched = await generateInsights(contextType, tasks, project);
            if (fetched && fetched.length > 0) {
                setInsights(fetched);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAcceptAction = async (insight: AIInsight) => {
        if (!insight.actionData?.prompt || isReadOnly) return;

        setGeneratingAction(insight);
        setIsGenerating(true);
        setIsGeneratedModalOpen(true);

        try {
            const content = await generateContentFromAction(insight.actionData.prompt);
            setGeneratedContent(content);

            // If linked to a task, update the task to indicate AI content exists
            if (insight.taskId) {
                const task = tasks.find(t => t.id === insight.taskId);
                if (task) {
                    const updatedTask = {
                        ...task,
                        aiGeneratedContent: content
                    };
                    await saveTask(updatedTask);
                    onTaskUpdate();
                }
            }
        } catch (e) {
            console.error(e);
            setGeneratedContent("Failed to generate content.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (isDismissed || insights.length === 0) {
        if (isLoading) {
             return (
                 <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-6 flex items-center justify-center gap-3 text-slate-500">
                     <Loader2 size={16} className="animate-spin" /> <span className="text-sm font-medium">Generating AI Insights...</span>
                 </div>
             );
        }
        return null;
    }

    return (
        <>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-900/50 rounded-xl p-5 mb-6 shadow-sm animate-in fade-in slide-in-from-top-4 relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute right-0 top-0 w-64 h-64 bg-green-400/10 dark:bg-green-500/10 blur-3xl -translate-y-1/2 translate-x-1/3 rounded-full pointer-events-none"></div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="flex items-center gap-2 text-green-800 dark:text-green-400 font-bold">
                        <div className="bg-green-100 dark:bg-green-900/50 p-1.5 rounded-lg shadow-sm">
                            <Sparkles size={18} className="text-green-600 dark:text-green-400" />
                        </div>
                        AI Project Insights
                    </div>
                    <button onClick={() => setIsDismissed(true)} className="text-green-600/60 hover:text-green-800 dark:text-green-400/60 dark:hover:text-green-300 transition-colors p-1">
                        <X size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                    {insights.map((insight, idx) => (
                        <div key={idx} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-green-100 dark:border-green-900/30 rounded-lg p-4 shadow-sm flex flex-col hover:shadow-md transition-shadow group">
                            <div className="flex items-start gap-3 mb-2">
                                <div className="mt-0.5 shrink-0">
                                    {insight.type === 'action' ? (
                                        <Bot size={16} className="text-blue-500" />
                                    ) : insight.type === 'suggestion' ? (
                                        <CheckCircle2 size={16} className="text-amber-500" />
                                    ) : (
                                        <Sparkles size={16} className="text-green-500" />
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-tight">{insight.title}</h4>
                                </div>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 flex-1 ml-7 leading-relaxed">
                                {insight.description}
                            </p>

                            {insight.actionData?.prompt && !isReadOnly && (
                                <div className="mt-3 ml-7">
                                    <button
                                        onClick={() => handleAcceptAction(insight)}
                                        className="text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 py-1.5 px-3 rounded-md transition-colors flex items-center gap-1.5 group-hover:shadow-sm"
                                    >
                                        <Bot size={12} /> Action This / Generate
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Generated Content Modal */}
            {isGeneratedModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Bot size={20} className="text-blue-500" />
                                AI Generated Content
                            </h2>
                            <button onClick={() => { setIsGeneratedModalOpen(false); setGeneratedContent(null); }} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-900">
                            {isGenerating ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-4">
                                    <Loader2 size={32} className="animate-spin text-blue-500" />
                                    <p className="text-sm font-medium">Generating content based on "{generatingAction?.title}"...</p>
                                </div>
                            ) : (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {generatedContent || ''}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-between items-center">
                            <p className="text-xs text-slate-500 italic">
                                {generatingAction?.taskId ? 'This content has been appended to the task notes.' : 'You can copy this text to use it elsewhere.'}
                            </p>
                            <button
                                onClick={() => {
                                    if (generatedContent) {
                                        navigator.clipboard.writeText(generatedContent);
                                    }
                                    setIsGeneratedModalOpen(false);
                                }}
                                disabled={isGenerating}
                                className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                <Check size={16} /> Copy & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
