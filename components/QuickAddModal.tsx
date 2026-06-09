import React, { useState, useMemo } from 'react';
import { Task, Category, Project, Idea } from '../types';
import { extractTaskDetails, ExtractedTaskDetails } from '../services/aiService';
import { usePlannerData } from '../src/context/PlannerContext';
import { X, Check, Bot, Sparkles } from 'lucide-react';

interface QuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    categories: Category[];
    projects: Project[];
    onSaveTask: (task: Task) => void;
    onSaveIdea: (idea: Idea) => void;
}

const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose, categories, projects, onSaveTask, onSaveIdea }) => {
    const [activeTab, setActiveTab] = useState<'task' | 'idea'>('task');

    // Task State
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskPriority, setTaskPriority] = useState<Task['priority']>('Medium');
    const [taskCategoryId, setTaskCategoryId] = useState('');
    const [taskProjectId, setTaskProjectId] = useState('');
    const [taskScheduledDateStr, setTaskScheduledDateStr] = useState('');
    const [taskDeadlineDateStr, setTaskDeadlineDateStr] = useState('');

        // AI State
    const [aiTaskInput, setAiTaskInput] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [preview, setPreview] = useState<ExtractedTaskDetails | null>(null);

    const { timetableWeek1, timetableWeek2, terms } = usePlannerData();

    // Unique subjects/classes from the timetable, used to help the AI interpret class references.
    const subjects = useMemo(() => {
        const set = new Set<string>();
        [timetableWeek1, timetableWeek2].forEach(tt => {
            Object.values(tt || {}).forEach((daySchedule: any) => {
                Object.values(daySchedule || {}).forEach((entry: any) => {
                    if (entry?.subject) set.add(entry.subject);
                });
            });
        });
        return Array.from(set).sort();
    }, [timetableWeek1, timetableWeek2]);

    // End date of the term containing today (for "end of term" phrasing).
    const termEndISO = useMemo(() => {
        const now = new Date();
        const current = (terms || []).find(t => {
            const start = t.startDate instanceof Date ? t.startDate : new Date(t.startDate);
            const end = t.endDate instanceof Date ? t.endDate : new Date(t.endDate);
            return now >= start && now <= end;
        });
        if (!current) return undefined;
        const end = current.endDate instanceof Date ? current.endDate : new Date(current.endDate);
        return end.toISOString().split('T')[0];
    }, [terms]);

// Idea State
    const [ideaText, setIdeaText] = useState('');
    const [ideaProjectId, setIdeaProjectId] = useState('');

    if (!isOpen) return null;

    const taskCategories = categories.filter(c => c.type === 'project' || c.type === 'task');

    // Filter projects based on the selected category.
    // Ensure we don't accidentally filter out the General Tasks project if it exists.
    const filteredProjects = taskCategoryId
        ? projects.filter(p => p.categoryId === taskCategoryId)
        : projects;

    const selectedCategory = categories.find(c => c.id === taskCategoryId);
    const generalTasksProject = selectedCategory
        ? filteredProjects.find(p => p.name === `${selectedCategory.name} General Tasks`)
        : null;


    const handleAiTaskExtract = async () => {
        if (!aiTaskInput.trim()) return;
        setIsExtracting(true);
        setPreview(null);
        try {
            const todayISO = new Date().toISOString().split('T')[0];
            const details = await extractTaskDetails(aiTaskInput, projects, categories, {
                subjects,
                todayISO,
                termEndISO,
            });
            if (!details.title) {
                console.warn("AI returned no task title for input:", aiTaskInput);
                return;
            }
            setPreview(details);
        } catch (e) {
            console.error("Failed to extract task details:", e);
        } finally {
            setIsExtracting(false);
        }
    };

    const applyPreview = () => {
        if (!preview) return;
        if (preview.title) setTaskTitle(preview.title);
        if (preview.description) setTaskDescription(preview.description);
        if (preview.priority) setTaskPriority(preview.priority as any);
        if (preview.scheduledDateStr) setTaskScheduledDateStr(preview.scheduledDateStr);
        if (preview.deadlineDateStr) setTaskDeadlineDateStr(preview.deadlineDateStr);
        if (preview.projectId) setTaskProjectId(preview.projectId);
        if (preview.categoryId) setTaskCategoryId(preview.categoryId);
        setPreview(null);
        setAiTaskInput('');
    };
const handleSaveTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskTitle.trim()) return;

        const newTask: Task = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            projectId: taskProjectId || 'global',
            title: taskTitle.trim(),
            description: taskDescription.trim() || undefined,
            status: 'Uncompleted',
            priority: taskPriority,
            categoryId: taskCategoryId || undefined,
            scheduledDateStr: taskScheduledDateStr || undefined,
            deadlineDateStr: taskDeadlineDateStr || undefined,
            subtasks: []
        };

        onSaveTask(newTask);
        resetForm();
        onClose();
    };

    const handleSaveIdea = (e: React.FormEvent) => {
        e.preventDefault();
        if (!ideaText.trim()) return;

        const newIdea: Idea = {
            id: `idea_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: ideaText.trim(),
            projectId: ideaProjectId || undefined,
            createdAt: Date.now()
        };

        onSaveIdea(newIdea);
        resetForm();
        onClose();
    };

    const resetForm = () => {
        setTaskTitle('');
        setTaskDescription('');
        setTaskPriority('Medium');
        setTaskCategoryId('');
        setTaskProjectId('');
        setTaskScheduledDateStr('');
        setTaskDeadlineDateStr('');
        setIdeaText('');
        setIdeaProjectId('');
        setAiTaskInput('');
        setPreview(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
                    <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('task')}
                            className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${activeTab === 'task' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            Quick Add Task
                        </button>
                        <button
                            onClick={() => setActiveTab('idea')}
                            className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${activeTab === 'idea' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            Jot an Idea
                        </button>
                    </div>
                    <button onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {activeTab === 'task' ? (
                        <form id="quickAddTaskForm" onSubmit={handleSaveTask} className="space-y-4">
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/50 rounded-lg p-3 flex items-center gap-3 mb-2">
                            <Bot className="text-blue-500 shrink-0" size={20} />
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={aiTaskInput}
                                    onChange={(e) => setAiTaskInput(e.target.value)}
                                    placeholder="Describe task naturally (e.g., 'Grade papers tomorrow high priority')"
                                    className="w-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg pl-3 pr-24 py-2 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAiTaskExtract();
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleAiTaskExtract}
                                    disabled={!aiTaskInput.trim() || isExtracting}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-3 py-1 rounded-md transition-colors"
                                >
                                    {isExtracting ? 'Extracting...' : 'Extract'}
                                </button>
                            </div>
                        </div>

                        {preview && (
                            <div className="border border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/15 rounded-lg p-3 mb-2 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
                                        <Sparkles size={14} /> AI suggestion
                                    </div>
                                    {(() => {
                                        const c = preview.confidence ?? 0;
                                        const cfg = c >= 0.7
                                            ? { label: 'High confidence', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' }
                                            : c >= 0.4
                                            ? { label: 'Medium confidence', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' }
                                            : { label: 'Low confidence', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' };
                                        return (
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                                                {cfg.label} · {Math.round(c * 100)}%
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                    <div><span className="font-semibold">Title:</span> {preview.title}</div>
                                    {preview.description && <div className="text-xs text-slate-500 dark:text-slate-400">{preview.description}</div>}
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 pt-1">
                                        <span><span className="font-semibold">Priority:</span> {preview.priority}</span>
                                        {preview.scheduledDateStr && <span><span className="font-semibold">Scheduled:</span> {preview.scheduledDateStr}</span>}
                                        {preview.deadlineDateStr && <span><span className="font-semibold">Deadline:</span> {preview.deadlineDateStr}</span>}
                                        {preview.categoryId && <span><span className="font-semibold">Category:</span> {categories.find(c => c.id === preview.categoryId)?.name || preview.categoryId}</span>}
                                        {preview.projectId && <span><span className="font-semibold">Project:</span> {projects.find(p => p.id === preview.projectId)?.name || preview.projectId}</span>}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-3">
                                    <button type="button" onClick={() => setPreview(null)} className="px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors">
                                        Discard
                                    </button>
                                    <button type="button" onClick={applyPreview} className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-1">
                                        <Check size={13} /> Apply
                                    </button>
                                </div>
                            </div>
                        )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Title *</label>
                                <input
                                    type="text"
                                    value={taskTitle}
                                    onChange={(e) => setTaskTitle(e.target.value)}
                                    required
                                    autoFocus
                                    placeholder="What needs to be done?"
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description / Notes</label>
                                <textarea
                                    value={taskDescription}
                                    onChange={(e) => setTaskDescription(e.target.value)}
                                    placeholder="Add details, notes, or steps..."
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 min-h-[80px]"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                                    <select
                                        value={taskCategoryId}
                                        onChange={(e) => {
                                            const newCategoryId = e.target.value;
                                            setTaskCategoryId(newCategoryId);

                                            // Find the General Tasks project for the newly selected category
                                            const newCategory = categories.find(c => c.id === newCategoryId);
                                            const newGeneralTasksProject = newCategory
                                                ? projects.find(p => p.categoryId === newCategoryId && p.name === `${newCategory.name} General Tasks`)
                                                : null;

                                            // If a General Tasks project exists, select it by default, otherwise reset
                                            setTaskProjectId(newGeneralTasksProject ? newGeneralTasksProject.id : '');
                                        }}
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                    >
                                        <option value="">None</option>
                                        {taskCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Project</label>
                                    <select
                                        value={taskProjectId}
                                        onChange={(e) => setTaskProjectId(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                    >
                                        <option value="">
                                            {selectedCategory ? 'No Specific Project' : 'No Project (Global Task)'}
                                        </option>
                                        {taskCategoryId && generalTasksProject && (
                                            <option value={generalTasksProject.id}>{generalTasksProject.name}</option>
                                        )}
                                        {filteredProjects
                                            .filter(p => !generalTasksProject || p.id !== generalTasksProject.id)
                                            .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                                        }
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Priority</label>
                                    <select
                                        value={taskPriority}
                                        onChange={(e) => setTaskPriority(e.target.value as any)}
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                    >
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Scheduled Date</label>
                                    <input
                                        type="date"
                                        value={taskScheduledDateStr}
                                        onChange={(e) => setTaskScheduledDateStr(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Deadline Date</label>
                                    <input
                                        type="date"
                                        value={taskDeadlineDateStr}
                                        onChange={(e) => setTaskDeadlineDateStr(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>
                        </form>
                    ) : (
                        <form id="quickAddIdeaForm" onSubmit={handleSaveIdea} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Idea / Note *</label>
                                <textarea
                                    value={ideaText}
                                    onChange={(e) => setIdeaText(e.target.value)}
                                    required
                                    autoFocus
                                    placeholder="Write down a quick thought or idea..."
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 min-h-[120px]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Project (Optional)</label>
                                <select
                                    value={ideaProjectId}
                                    onChange={(e) => setIdeaProjectId(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                >
                                    <option value="">No Project (Global Idea)</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </form>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form={activeTab === 'task' ? "quickAddTaskForm" : "quickAddIdeaForm"}
                        disabled={activeTab === 'task' ? !taskTitle.trim() : !ideaText.trim()}
                        className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        <Check size={16} /> Save {activeTab === 'task' ? 'Task' : 'Idea'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickAddModal;