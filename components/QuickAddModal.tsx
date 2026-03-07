import React, { useState } from 'react';
import { Task, Category, Project, Idea } from '../types';
import { extractTaskDetails } from '../services/aiService';
import { X, Check, Bot } from 'lucide-react';

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

// Idea State
    const [ideaText, setIdeaText] = useState('');
    const [ideaProjectId, setIdeaProjectId] = useState('');

    if (!isOpen) return null;

    const taskCategories = categories.filter(c => c.type === 'task');


    const handleAiTaskExtract = async () => {
        if (!aiTaskInput.trim()) return;
        setIsExtracting(true);
        try {
            const details = await extractTaskDetails(aiTaskInput, projects, categories);
            if (details.title) setTaskTitle(details.title);
            if (details.description) setTaskDescription(details.description);
            if (details.priority) setTaskPriority(details.priority as any);
            if (details.scheduledDateStr) setTaskScheduledDateStr(details.scheduledDateStr);
            if (details.deadlineDateStr) setTaskDeadlineDateStr(details.deadlineDateStr);
            if (details.projectId) setTaskProjectId(details.projectId);
            if (details.categoryId) setTaskCategoryId(details.categoryId);
            setAiTaskInput('');
        } catch (e) {
            console.error("Failed to extract task details:", e);
        } finally {
            setIsExtracting(false);
        }
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
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Project</label>
                                    <select
                                        value={taskProjectId}
                                        onChange={(e) => setTaskProjectId(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                    >
                                        <option value="">No Project (Global Task)</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                                    <select
                                        value={taskCategoryId}
                                        onChange={(e) => setTaskCategoryId(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                    >
                                        <option value="">None</option>
                                        {taskCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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