import React, { useMemo, useState } from 'react';
import { Task, Project, Category } from '../types';
import {
    CheckCircle2,
    Circle,
    Clock,
    CalendarDays,
    Calendar,
    Search,
    Filter,
    Edit2,
    Trash2,
    Bot
} from 'lucide-react';
import { saveTask, deleteTask } from '../services/projectService';
import TaskEditModal from './TaskEditModal';
import AIInsightsPanel from './AIInsightsPanel';
import AIContentModal from './AIContentModal';

interface GlobalTasksViewProps {
    allTasks: Task[];
    projects: Project[];
    categories: Category[];
    isReadOnly: boolean;
    onTaskUpdate: () => void;
}

type ViewMode = 'list' | 'timeline' | 'matrix';

export default function GlobalTasksView({ allTasks, projects, categories, isReadOnly, onTaskUpdate }: GlobalTasksViewProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('matrix');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

    const toggleTaskSelection = (taskId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const newSelection = new Set(selectedTaskIds);
        if (newSelection.has(taskId)) {
            newSelection.delete(taskId);
        } else {
            newSelection.add(taskId);
        }
        setSelectedTaskIds(newSelection);
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedTaskIds.size} selected task(s)?`)) return;
        const idsToDelete = Array.from(selectedTaskIds);
        setSelectedTaskIds(new Set());
        for (const id of idsToDelete) {
            try { await deleteTask(id); } catch (e) { console.error("Failed to delete task in bulk", id, e); }
        }
    };

    const handleBulkComplete = async () => {
        const idsToUpdate = Array.from(selectedTaskIds);
        setSelectedTaskIds(new Set());
        const flatTasks = allTasks;
        for (const id of idsToUpdate) {
            const task = flatTasks.find(t => t.id === id);
            if (task && task.status !== 'Completed') {
                try { await saveTask({ ...task, status: 'Completed' as const }); } catch (e) { console.error("Failed to complete task in bulk", id, e); }
            }
        }
    };

    const [filterProject, setFilterProject] = useState<string>('All');
    const [filterCategory, setFilterCategory] = useState<string>('All');

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // AI Content Modal State
    const [aiContentModalOpen, setAiContentModalOpen] = useState(false);
    const [selectedAiContent, setSelectedAiContent] = useState<string | null>(null);
    const [selectedAiTaskTitle, setSelectedAiTaskTitle] = useState('');
    const [selectedAiTaskId, setSelectedAiTaskId] = useState<string | null>(null);

    const projectCategories = categories.filter(c => c.type === 'project');
    const taskCategories = categories.filter(c => c.type === 'task');

    // Derived Data & Filtering
    const filteredTasks = useMemo(() => {
        return allTasks.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesProj = filterProject === 'All' || t.projectId === filterProject;
            const matchesCat = filterCategory === 'All' || t.categoryId === filterCategory;
            return matchesSearch && matchesProj && matchesCat;
        });
    }, [allTasks, searchQuery, filterProject, filterCategory]);

    // Helpers
    const getProjectName = (projectId: string) => {
        const p = projects.find(p => p.id === projectId);
        return p ? p.name : 'Unknown Project';
    };

    const getCategoryDetails = (catId?: string) => {
        return categories.find(c => c.id === catId);
    };

    const handleToggleStatus = async (task: Task) => {
        if (isReadOnly) return;
        const nextStatus: Task['status'] = task.status === 'Completed' ? 'Uncompleted'
                         : task.status === 'Uncompleted' ? 'In Progress'
                         : 'Completed';

        const updated = { ...task, status: nextStatus };
        try {
            await saveTask(updated);
            onTaskUpdate();
        } catch (e) {
            console.error(e);
            alert("Failed to update task.");
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (isReadOnly) return;
        if (window.confirm("Are you sure you want to delete this task?")) {
            try {
                await deleteTask(taskId);
                onTaskUpdate();
            } catch (e) {
                console.error(e);
                alert("Failed to delete task.");
            }
        }
    };

    const handleEditTaskSave = async (updatedTask: Task) => {
        if (isReadOnly) return;

        try {
            await saveTask(updatedTask);
            onTaskUpdate();
        } catch (e) {
            console.error("Failed to save edited task", e);
            alert("Failed to save changes.");
        } finally {
            setEditingTask(null);
            setIsEditModalOpen(false);
        }
    };

    const openEditModal = (task: Task) => {
        setEditingTask(task);
        setIsEditModalOpen(true);
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'High': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50';
            case 'Medium': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
            case 'Low': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50';
            default: return 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Completed': return <CheckCircle2 size={16} className="text-green-500" />;
            case 'In Progress': return <Clock size={16} className="text-amber-500" />;
            default: return <Circle size={16} className="text-slate-300 dark:text-slate-600" />;
        }
    };

    // Sub-Views

    const renderMatrixView = () => {
        // Eisenhower Matrix logic
        // Y-Axis: Importance (Priority)
        // X-Axis: Urgency (Dates)
        // For simplicity:
        // Quadrant 1 (Do First): Urgent & Important (High Priority + Deadline soon/passed)
        // Quadrant 2 (Schedule): Not Urgent & Important (High Priority + No deadline or far future)
        // Quadrant 3 (Delegate): Urgent & Not Important (Med/Low Priority + Deadline soon)
        // Quadrant 4 (Don't Do): Not Urgent & Not Important (Med/Low Priority + No deadline)

        const isUrgent = (task: Task) => {
            if (!task.deadlineDateStr && !task.scheduledDateStr) return false;
            const targetDate = task.deadlineDateStr ? new Date(task.deadlineDateStr) : new Date(task.scheduledDateStr!);
            const now = new Date();
            const daysDiff = (targetDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
            return daysDiff <= 7; // Urgent if due within 7 days
        };

        const q1 = filteredTasks.filter(t => t.status !== 'Completed' && t.priority === 'High' && isUrgent(t));
        const q2 = filteredTasks.filter(t => t.status !== 'Completed' && t.priority === 'High' && !isUrgent(t));
        const q3 = filteredTasks.filter(t => t.status !== 'Completed' && t.priority !== 'High' && isUrgent(t));
        const q4 = filteredTasks.filter(t => t.status !== 'Completed' && t.priority !== 'High' && !isUrgent(t));

        const TaskCard = ({ task }: { task: Task }) => {
            const cat = getCategoryDetails(task.categoryId);
            const subtasks = task.subtasks || [];
            const completedSubtasks = subtasks.filter(st => st.status === 'Completed').length;
            const hasSubtasks = subtasks.length > 0;
            const project = projects.find(p => p.id === task.projectId);
            const bgColorClass = project?.colorClass || 'bg-white dark:bg-slate-800';



    return (
                <div className={`group p-3 ${bgColorClass} rounded-lg shadow-sm border ${getPriorityColor(task.priority)} flex flex-col gap-2 relative`}>
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                            <button onClick={() => handleToggleStatus(task)} disabled={isReadOnly} className={`mt-0.5 shrink-0 ${isReadOnly ? '' : 'hover:scale-110'}`}>
                                {getStatusIcon(task.status)}
                            </button>
                            <span className="font-semibold text-sm leading-tight text-slate-800 dark:text-slate-100 break-words">{task.title}</span>
                        </div>
                        {!isReadOnly && (
                            <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-white/80 dark:bg-slate-800/80 p-1 rounded-md backdrop-blur-sm shadow-sm border border-slate-200 dark:border-slate-700">
                                <button onClick={(e) => { e.stopPropagation(); openEditModal(task); }} className="p-1 text-slate-400 hover:text-blue-500 rounded" title="Edit Task">
                                    <Edit2 size={14} />
                                </button>
                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteTask(task.id); }} className="p-1 text-slate-400 hover:text-red-500 rounded" title="Delete Task">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-1 pl-6 mt-[-4px]">
                        {hasSubtasks && (
                            <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                                <CheckCircle2 size={10} /> {completedSubtasks}/{subtasks.length} subtasks
                            </div>
                        )}
                        {task.aiGeneratedContent && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAiContent(task.aiGeneratedContent || null);
                                    setSelectedAiTaskTitle(task.title);
                                    setSelectedAiTaskId(task.id);
                                    setAiContentModalOpen(true);
                                }}
                                className="text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 w-fit bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                                <Bot size={10} /> View AI Content
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[10px] mt-auto">
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={getProjectName(task.projectId)}>
                            {getProjectName(task.projectId)}
                        </span>
                        {cat && (
                            <span className={`px-1.5 py-0.5 rounded border ${cat.colorClass}`}>
                                {cat.name}
                            </span>
                        )}
                        {(task.deadlineDateStr || task.scheduledDateStr) && (
                            <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${isUrgent(task) ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/30 dark:border-red-800' : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700'}`}>
                                <CalendarDays size={10} />
                                {task.deadlineDateStr ? new Date(task.deadlineDateStr).toLocaleDateString() : new Date(task.scheduledDateStr!).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
            );
        };

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-[600px]">
            {selectedTaskIds.size > 0 && !isReadOnly && (
                <div className="bulk-action-bar fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white dark:bg-slate-800 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10 fade-in">
                    <span className="text-sm font-medium">{selectedTaskIds.size} selected</span>
                    <div className="w-px h-4 bg-slate-700"></div>
                    <button onClick={handleBulkComplete} className="text-sm hover:text-green-400 flex items-center gap-1 transition-colors">
                        <CheckCircle2 size={16} /> Mark Completed
                    </button>
                    <button onClick={handleBulkDelete} className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                        <Trash2 size={16} /> Delete
                    </button>
                </div>
            )}

                {/* Q1: Do */}
                <div className="bg-red-50/50 dark:bg-red-950/20 rounded-xl p-4 border border-red-100 dark:border-red-900/30 flex flex-col">
                    <h3 className="font-bold text-red-800 dark:text-red-400 mb-4 flex items-center justify-between">
                        <span>Do First (Urgent & Important)</span>
                        <span className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full text-xs">{q1.length}</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                        {q1.length === 0 ? <p className="text-sm italic text-red-400/60 text-center mt-10">No urgent high-priority tasks.</p> : q1.map(t => <TaskCard key={t.id} task={t} />)}
                    </div>
                </div>

                {/* Q2: Schedule */}
                <div className="bg-green-50/50 dark:bg-green-950/20 rounded-xl p-4 border border-green-100 dark:border-green-900/30 flex flex-col">
                    <h3 className="font-bold text-green-800 dark:text-green-400 mb-4 flex items-center justify-between">
                        <span>Schedule (Important, Not Urgent)</span>
                        <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full text-xs">{q2.length}</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                        {q2.length === 0 ? <p className="text-sm italic text-green-400/60 text-center mt-10">No unscheduled high-priority tasks.</p> : q2.map(t => <TaskCard key={t.id} task={t} />)}
                    </div>
                </div>

                {/* Q3: Delegate */}
                <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30 flex flex-col">
                    <h3 className="font-bold text-amber-800 dark:text-amber-400 mb-4 flex items-center justify-between">
                        <span>Delegate / Monitor (Urgent, Less Important)</span>
                        <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full text-xs">{q3.length}</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                        {q3.length === 0 ? <p className="text-sm italic text-amber-400/60 text-center mt-10">No urgent lower-priority tasks.</p> : q3.map(t => <TaskCard key={t.id} task={t} />)}
                    </div>
                </div>

                {/* Q4: Eliminate / Later */}
                <div className="bg-slate-100/50 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex flex-col">
                    <h3 className="font-bold text-slate-600 dark:text-slate-400 mb-4 flex items-center justify-between">
                        <span>Do Later / Drop (Not Urgent, Less Important)</span>
                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs">{q4.length}</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                        {q4.length === 0 ? <p className="text-sm italic text-slate-400/60 text-center mt-10">No background tasks.</p> : q4.map(t => <TaskCard key={t.id} task={t} />)}
                    </div>
                </div>
            </div>
        );
    };

    const renderTimelineView = () => {
        // Sort tasks by date (earliest first), put tasks without dates at the bottom
        const sortedTasks = [...filteredTasks].sort((a, b) => {
            const dateA = a.deadlineDateStr || a.scheduledDateStr || '9999-12-31';
            const dateB = b.deadlineDateStr || b.scheduledDateStr || '9999-12-31';
            return new Date(dateA).getTime() - new Date(dateB).getTime();
        });

        // Group by month/year
        const groups: Record<string, Task[]> = {};
        sortedTasks.forEach(task => {
            const dateStr = task.deadlineDateStr || task.scheduledDateStr;
            const groupKey = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unscheduled';
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(task);
        });

        return (
            <div className="max-w-4xl mx-auto py-8">
                {Object.keys(groups).length === 0 ? (
                    <p className="text-center text-slate-500 py-12">No tasks found.</p>
                ) : (
                    <div className="space-y-12">
                        {Object.entries(groups).map(([month, monthTasks]) => (
                            <div key={month} className="relative">
                                {/* Timeline Line */}
                                <div className="absolute left-[27px] top-8 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-800 -z-10"></div>

                                <h3 className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-950 py-2 text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                                    <div className="w-14 h-14 bg-white dark:bg-slate-900 border-4 border-gray-50 dark:border-slate-950 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 shadow-sm shrink-0">
                                        <Calendar size={20} />
                                    </div>
                                    {month}
                                </h3>

                                <div className="mt-6 space-y-6 ml-16">
                                    {monthTasks.map(task => {
                                        const cat = getCategoryDetails(task.categoryId);
                                        const isCompleted = task.status === 'Completed';
                                        const dateStr = task.deadlineDateStr || task.scheduledDateStr;
                                        const subtasks = task.subtasks || [];
                                        const completedSubtasks = subtasks.filter(st => st.status === 'Completed').length;
                                        const hasSubtasks = subtasks.length > 0;
                                        const project = projects.find(p => p.id === task.projectId);
                                        const bgColorClass = project?.colorClass || 'bg-white dark:bg-slate-900';

                                        return (
                                            <div key={task.id} className={`${bgColorClass} p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 transition-opacity ${isCompleted ? 'opacity-50' : ''}`}>

                                                {/* Left side: Date Badge */}
                                                <div className="shrink-0 md:w-24 flex flex-row md:flex-col items-center md:items-start gap-2 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 pb-3 md:pb-0 md:pr-4">
                                                    {dateStr ? (
                                                        <>
                                                            <span className="text-2xl font-bold text-slate-800 dark:text-white leading-none">
                                                                {new Date(dateStr).getDate()}
                                                            </span>
                                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                                                {new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' })}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-sm font-semibold text-slate-400 italic">None</span>
                                                    )}
                                                </div>

                                                {/* Right Side: Content */}
                                                <div className="flex-1 flex items-start justify-between gap-3 group/task">
                                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                                        <button onClick={() => handleToggleStatus(task)} disabled={isReadOnly} className={`mt-0.5 shrink-0 ${isReadOnly ? '' : 'hover:scale-110'}`}>
                                                            {getStatusIcon(task.status)}
                                                        </button>

                                                        <div className="flex-1 min-w-0">
                                                        <h4 className={`font-semibold text-lg text-slate-900 dark:text-white leading-tight mb-2 ${isCompleted ? 'line-through' : ''}`}>
                                                            {task.title}
                                                        </h4>
                                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                                            {hasSubtasks && (
                                                                <span className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                    <CheckCircle2 size={10} /> {completedSubtasks}/{subtasks.length}
                                                                </span>
                                                            )}
                                                            {task.aiGeneratedContent && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedAiContent(task.aiGeneratedContent || null);
                                                                        setSelectedAiTaskTitle(task.title);
                                                                        setSelectedAiTaskId(task.id);
                                                                        setAiContentModalOpen(true);
                                                                    }}
                                                                    className="text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                                                >
                                                                    <Bot size={10} /> View AI Content
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                                                                {task.priority} Priority
                                                            </span>
                                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                                                                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                                                {getProjectName(task.projectId)}
                                                            </span>
                                                            {cat && (
                                                                <span className={`px-2 py-0.5 rounded-full border ${cat.colorClass}`}>
                                                                    {cat.name}
                                                                </span>
                                                            )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {!isReadOnly && (
                                                        <div className="flex gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity shrink-0">
                                                            <button onClick={(e) => { e.stopPropagation(); openEditModal(task); }} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Edit Task">
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteTask(task.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete Task">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
            {/* Filters Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 shrink-0 flex flex-col md:flex-row justify-between gap-4 sticky top-0 z-20">

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start">
                    <button onClick={() => setViewMode('matrix')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'matrix' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Matrix</button>
                    <button onClick={() => setViewMode('timeline')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'timeline' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Timeline</button>
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-3 items-center w-full md:w-auto">
                    <div className="relative flex-1 md:w-64 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    <select
                        value={filterProject}
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 max-w-[150px]"
                    >
                        <option value="All">All Projects</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 max-w-[150px]"
                    >
                        <option value="All">All Categories</option>
                        {taskCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-slate-950 custom-scrollbar">

                <AIInsightsPanel
                    contextType="all_tasks"
                    tasks={allTasks}
                    isReadOnly={isReadOnly}
                    onTaskUpdate={onTaskUpdate}
                />

                {viewMode === 'matrix' ? renderMatrixView() : renderTimelineView()}
            </div>

            <TaskEditModal
                isOpen={isEditModalOpen}
                onClose={() => { setIsEditModalOpen(false); setEditingTask(null); }}
                task={editingTask}
                categories={categories}
                onSave={handleEditTaskSave}
            />

            <AIContentModal
                isOpen={aiContentModalOpen}
                onClose={() => setAiContentModalOpen(false)}
                content={selectedAiContent}
                title={selectedAiTaskTitle}
                onSave={async (newContent) => {
                    if (isReadOnly || !selectedAiTaskId) return;
                    const task = allTasks.find(t => t.id === selectedAiTaskId);
                    if (task) {
                        try {
                            const updatedTask = { ...task, aiGeneratedContent: newContent };
                            await saveTask(updatedTask);
                            setSelectedAiContent(newContent);
                            onTaskUpdate();
                        } catch (e) {
                            console.error("Failed to save AI content to task", e);
                            alert("Failed to save AI content.");
                        }
                    }
                }}
            />
        </div>
    );
}