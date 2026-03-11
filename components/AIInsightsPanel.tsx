import React, { useState, useEffect } from 'react';
import { generateInsights, AIInsight, generateContentFromAction } from '../services/aiService';
import { Sparkles, X, Check, Loader2, Bot, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { Task, Project } from '../types';
import { saveTask } from '../services/projectService';
import AIContentModal from './AIContentModal';
import ReviewTasksModal from './ReviewTasksModal';

// Global cache for insights to avoid regenerating every time the component remounts
const insightsCache: Record<string, AIInsight[]> = {};
const dismissedCache: Set<string> = new Set();

interface AIInsightsPanelProps {
    contextType: 'project' | 'all_tasks';
    tasks: Task[];
    project?: Project;
    isReadOnly: boolean;
    onTaskUpdate?: () => void;
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

    // Review Tasks Modal State
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [reviewTasks, setReviewTasks] = useState<Task[]>([]);
    const [reviewActionType, setReviewActionType] = useState<'delete_tasks' | 'group_tasks' | 'review_tasks' | 'update_tasks' | 'generic'>('generic');
    const [reviewPrompt, setReviewPrompt] = useState<string | undefined>(undefined);

    const cacheKey = contextType === 'project' ? `project_${project?.id}` : 'all_tasks';

    useEffect(() => {
        // Initialize from cache
        if (dismissedCache.has(cacheKey)) {
            setIsDismissed(true);
            return;
        }

        if (insightsCache[cacheKey]) {
            setInsights(insightsCache[cacheKey]);
            return;
        }
    }, [contextType, project?.id, cacheKey]); // Refetch if project changes or context changes

    const loadInsights = async () => {
        setIsLoading(true);
        try {
            const fetched = await generateInsights(contextType, tasks, project);
            if (fetched) {
                insightsCache[cacheKey] = fetched;
                if (fetched.length > 0) {
                    setInsights(fetched);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDismiss = () => {
        setIsDismissed(true);
        dismissedCache.add(cacheKey);
    };

    const handleAcceptAction = async (insight: AIInsight) => {
        if (!insight.actionData?.prompt || isReadOnly) return;

        // If the insight specifies an action type that targets tasks
        if (insight.actionType !== 'generate_content' && insight.taskIds && insight.taskIds.length > 0) {
            const targetedTasks = tasks.filter(t => insight.taskIds!.includes(t.id));
            if (targetedTasks.length > 0) {
                setReviewTasks(targetedTasks);
                setReviewActionType(insight.actionType as any);
                setReviewPrompt(insight.actionData.prompt);
                setReviewModalOpen(true);
                return;
            }
        }

        // If it targets a single task using the old 'taskId' prop (for backwards compatibility),
        // or just generating general content
        setGeneratingAction(insight);
        setIsGenerating(true);
        setIsGeneratedModalOpen(true);

        try {
            const content = await generateContentFromAction(insight.actionData.prompt);
            setGeneratedContent(content);

            // If linked to a task (old single taskId format), update the task to indicate AI content exists
            // Since we changed to taskIds, we check the first element if taskIds is present but length 1,
            // or we use the old logic if legacy data exists.
            const targetTaskId = (insight as any).taskId || (insight.taskIds && insight.taskIds.length === 1 ? insight.taskIds[0] : null);

            if (targetTaskId) {
                const task = tasks.find(t => t.id === targetTaskId);
                if (task) {
                    const updatedTask = {
                        ...task,
                        aiGeneratedContent: content
                    };
                    await saveTask(updatedTask);
                    if (onTaskUpdate) onTaskUpdate();
                }
            }
        } catch (e) {
            console.error(e);
            setGeneratedContent("Failed to generate content.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (isDismissed) {
        return null;
    }

    if (insights.length === 0) {
        return (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-6 flex items-center justify-between gap-3 text-slate-500 shadow-sm transition-all hover:shadow">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200">AI Project Insights</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Discover actionable suggestions and ideas based on your tasks.</p>
                    </div>
                </div>
                {!isReadOnly && (
                    <button
                        onClick={loadInsights}
                        disabled={isLoading || tasks.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
                    >
                        {isLoading ? (
                            <><Loader2 size={16} className="animate-spin" /> Generating...</>
                        ) : (
                            <><Sparkles size={16} /> Generate Insights</>
                        )}
                    </button>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-5 mb-6 shadow-sm animate-in fade-in slide-in-from-top-4 relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute right-0 top-0 w-64 h-64 bg-blue-400/10 dark:bg-blue-500/10 blur-3xl -translate-y-1/2 translate-x-1/3 rounded-full pointer-events-none"></div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-400 font-bold">
                        <div className="bg-blue-100 dark:bg-blue-900/50 p-1.5 rounded-lg shadow-sm">
                            <Sparkles size={18} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        AI Project Insights
                    </div>
                    <div className="flex gap-2">
                        <button onClick={loadInsights} disabled={isLoading} className="text-blue-600/60 hover:text-blue-800 dark:text-blue-400/60 dark:hover:text-blue-300 transition-colors p-1" title="Regenerate Insights">
                            <Loader2 size={18} className={isLoading ? "animate-spin" : ""} />
                        </button>
                        <button onClick={handleDismiss} className="text-blue-600/60 hover:text-blue-800 dark:text-blue-400/60 dark:hover:text-blue-300 transition-colors p-1">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                    {insights.map((insight, idx) => (
                        <div key={idx} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-blue-100 dark:border-blue-900/30 rounded-lg p-4 shadow-sm flex flex-col hover:shadow-md transition-shadow group">
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
                                        <Bot size={12} /> {insight.taskIds && insight.taskIds.length > 0 ? "Review & Action" : "Action This / Generate"}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <ReviewTasksModal
                isOpen={reviewModalOpen}
                onClose={() => {
                    setReviewModalOpen(false);
                    setReviewTasks([]);
                    setReviewPrompt(undefined);
                }}
                tasks={reviewTasks}
                actionType={reviewActionType}
                initialPrompt={reviewPrompt}
                isReadOnly={isReadOnly}
                onTasksUpdated={onTaskUpdate}
            />

            {/* Generated Content Modal */}
            {isGenerating ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col items-center justify-center text-slate-500 space-y-4">
                        <Loader2 size={32} className="animate-spin text-blue-500" />
                        <p className="text-sm font-medium">Generating content based on "{generatingAction?.title}"...</p>
                    </div>
                </div>
            ) : (
                <AIContentModal
                    isOpen={isGeneratedModalOpen && generatedContent !== null}
                    onClose={() => {
                        setIsGeneratedModalOpen(false);
                        setGeneratedContent(null);
                    }}
                    content={generatedContent}
                    title={generatingAction?.title || 'AI Insights Action'}
                    onSave={async (newContent) => {
                        const targetTaskId = (generatingAction as any)?.taskId || (generatingAction?.taskIds && generatingAction.taskIds.length === 1 ? generatingAction.taskIds[0] : null);
                        if (isReadOnly || !targetTaskId) return;
                        const task = tasks.find(t => t.id === targetTaskId);
                        if (task) {
                            try {
                                const updatedTask = { ...task, aiGeneratedContent: newContent };
                                await saveTask(updatedTask);
                                setGeneratedContent(newContent);
                                if (onTaskUpdate) onTaskUpdate();
                            } catch (e) {
                                console.error("Failed to save AI content", e);
                                alert("Failed to save changes.");
                            }
                        }
                    }}
                />
            )}
        </>
    );
}
