import React, { useState } from 'react';
import { Project, Category, Task, ProjectLink } from '../types';
import { saveProject, saveTask, deleteTask } from '../services/projectService';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
    ChevronLeft,
    Settings,
    Link as LinkIcon,
    Plus,
    Trash2,
    CheckCircle2,
    Circle,
    Clock,
    CalendarDays,
    MoreVertical,
    Check,
    X,
    FolderKanban
} from 'lucide-react';

interface ProjectViewProps {
    project: Project;
    allCategories: Category[];
    allTasks: Task[];
    isReadOnly: boolean;
    onBack: () => void;
    onUpdateProject: (updatedProj: Project) => void;
}

const BACKGROUND_COLORS = [
    { label: 'Default', class: 'bg-gray-50 dark:bg-slate-950' },
    { label: 'Slate', class: 'bg-slate-100 dark:bg-slate-900' },
    { label: 'Blue', class: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Green', class: 'bg-green-50 dark:bg-green-950/30' },
    { label: 'Purple', class: 'bg-purple-50 dark:bg-purple-950/30' },
    { label: 'Rose', class: 'bg-rose-50 dark:bg-rose-950/30' },
    { label: 'Amber', class: 'bg-amber-50 dark:bg-amber-950/30' },
];

export default function ProjectView({ project, allCategories, allTasks, isReadOnly, onBack, onUpdateProject }: ProjectViewProps) {
    const [tasks, setTasks] = useState<Task[]>(allTasks);
    const [isEditingSettings, setIsEditingSettings] = useState(false);

    // Edit Settings State
    const [editDesc, setEditDesc] = useState(project.description || '');
    const [editBgColor, setEditBgColor] = useState(project.colorClass || BACKGROUND_COLORS[0].class);

    // New Link State
    const [isAddingLink, setIsAddingLink] = useState(false);
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [newLinkName, setNewLinkName] = useState('');

    // New Task State
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
    const [newTaskCategory, setNewTaskCategory] = useState('');
    const [newTaskScheduled, setNewTaskScheduled] = useState('');
    const [newTaskDeadline, setNewTaskDeadline] = useState('');

    const taskCategories = allCategories.filter(c => c.type === 'task');
    const projectCategory = allCategories.find(c => c.id === project.categoryId);

    // --- Handlers ---

    const handleSaveSettings = async () => {
        if (isReadOnly) return;
        const updated = { ...project, description: editDesc, colorClass: editBgColor };
        try {
            await saveProject(updated);
            onUpdateProject(updated);
            setIsEditingSettings(false);
        } catch (e) {
            console.error(e);
            alert("Failed to save project settings.");
        }
    };

    const handleAddLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly || !newLinkUrl.trim() || !newLinkName.trim()) return;

        const updatedLinks = [...project.links, { url: newLinkUrl.trim(), displayName: newLinkName.trim() }];
        const updated = { ...project, links: updatedLinks };

        try {
            await saveProject(updated);
            onUpdateProject(updated);
            setIsAddingLink(false);
            setNewLinkUrl('');
            setNewLinkName('');
        } catch (e) {
            console.error(e);
            alert("Failed to add link.");
        }
    };

    const handleDeleteLink = async (index: number) => {
        if (isReadOnly) return;
        const updatedLinks = project.links.filter((_, i) => i !== index);
        const updated = { ...project, links: updatedLinks };
        try {
            await saveProject(updated);
            onUpdateProject(updated);
        } catch (e) {
            console.error(e);
            alert("Failed to delete link.");
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly || !newTaskTitle.trim()) return;

        const newTask: Task = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            projectId: project.id,
            title: newTaskTitle.trim(),
            status: 'Uncompleted',
            priority: newTaskPriority,
            categoryId: newTaskCategory || undefined,
            scheduledDateStr: newTaskScheduled || undefined,
            deadlineDateStr: newTaskDeadline || undefined
        };

        try {
            await saveTask(newTask);
            setTasks([newTask, ...tasks]);
            setIsAddingTask(false);
            // Reset form
            setNewTaskTitle('');
            setNewTaskPriority('Medium');
            setNewTaskCategory('');
            setNewTaskScheduled('');
            setNewTaskDeadline('');
        } catch (e) {
            console.error(e);
            alert("Failed to create task.");
        }
    };

    const handleToggleTaskStatus = async (task: Task) => {
        if (isReadOnly) return;

        const nextStatus: Task['status'] = task.status === 'Completed' ? 'Uncompleted'
                         : task.status === 'Uncompleted' ? 'In Progress'
                         : 'Completed';

        const updated = { ...task, status: nextStatus };

        // Optimistic UI
        setTasks(tasks.map(t => t.id === task.id ? updated : t));

        try {
            await saveTask(updated);
        } catch (e) {
            console.error(e);
            // Revert
            setTasks(tasks.map(t => t.id === task.id ? task : t));
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (isReadOnly) return;
        if (window.confirm("Are you sure you want to delete this task?")) {
            try {
                await deleteTask(taskId);
                setTasks(tasks.filter(t => t.id !== taskId));
            } catch (e) {
                console.error(e);
                alert("Failed to delete task.");
            }
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'High': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
            case 'Medium': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
            case 'Low': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
            default: return 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    // Calculate statistics for the pie chart
    const getTaskStats = () => {
        const stats = {
            'Completed': 0,
            'In Progress': 0,
            'Uncompleted': 0
        };
        tasks.forEach(t => {
            if (stats[t.status] !== undefined) {
                stats[t.status]++;
            } else {
                stats['Uncompleted']++; // fallback
            }
        });

        const total = tasks.length;
        if (total === 0) return [];

        return [
            { name: 'Completed', value: stats['Completed'], color: '#22c55e' }, // green-500
            { name: 'In Progress', value: stats['In Progress'], color: '#f59e0b' }, // amber-500
            { name: 'Uncompleted', value: stats['Uncompleted'], color: '#cbd5e1' } // slate-300
        ].filter(item => item.value > 0);
    };

    const pieData = getTaskStats();

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Completed': return <CheckCircle2 size={20} className="text-green-500" />;
            case 'In Progress': return <Clock size={20} className="text-amber-500" />;
            default: return <Circle size={20} className="text-slate-300 dark:text-slate-600" />;
        }
    };

    return (
        <div className={`flex flex-col h-full overflow-hidden transition-colors duration-300 ${project.colorClass || 'bg-gray-50 dark:bg-slate-950'}`}>

            {/* Header Area */}
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-800/50 p-4 md:px-8 shrink-0 flex items-center justify-between z-10 sticky top-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{project.name}</h1>
                            {projectCategory && (
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${projectCategory.colorClass}`}>
                                    {projectCategory.name}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {!isReadOnly && (
                    <button
                        onClick={() => setIsEditingSettings(!isEditingSettings)}
                        className={`p-2 rounded-lg transition-colors border shadow-sm flex items-center gap-2 ${isEditingSettings ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                    >
                        <Settings size={18} /> <span className="hidden sm:inline text-sm font-medium">Project Settings</span>
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* Top Section: Settings / Description & Links */}
                    {isEditingSettings ? (
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                            <h3 className="text-lg font-bold mb-4">Project Settings</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                                    <textarea
                                        value={editDesc}
                                        onChange={(e) => setEditDesc(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm min-h-[100px]"
                                        placeholder="Add notes or a description here..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Background Color</label>
                                    <div className="flex flex-wrap gap-2">
                                        {BACKGROUND_COLORS.map(bg => (
                                            <button
                                                key={bg.class}
                                                onClick={() => setEditBgColor(bg.class)}
                                                className={`px-3 py-1.5 rounded-md text-sm border font-medium ${bg.class} ${editBgColor === bg.class ? 'ring-2 ring-green-500 border-transparent shadow-sm' : 'border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'}`}
                                            >
                                                {bg.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button onClick={() => setIsEditingSettings(false)} className="px-4 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
                                    <button onClick={handleSaveSettings} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">Save Changes</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                            {/* Left Column: Description & Pie Chart */}
                            <div className="md:col-span-2 space-y-6 flex flex-col">
                                {/* Description Card */}
                                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-slate-200/50 dark:border-slate-800/50 flex flex-col flex-1">
                                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">About</h3>
                                    <div className="prose prose-sm dark:prose-invert max-w-none flex-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                                        {project.description || <span className="italic opacity-60">No description provided.</span>}
                                    </div>
                                </div>

                                {/* Progress Chart Card */}
                                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-slate-200/50 dark:border-slate-800/50 h-[300px] flex flex-col">
                                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 shrink-0">Project Completion</h3>
                                    <div className="flex-1 w-full relative">
                                        {tasks.length === 0 ? (
                                            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 italic">
                                                Add tasks to see progress
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {pieData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        formatter={(value: number, name: string) => {
                                                            const percentage = ((value / tasks.length) * 100).toFixed(0);
                                                            return [`${value} tasks (${percentage}%)`, name];
                                                        }}
                                                    />
                                                    <Legend verticalAlign="bottom" height={36} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Links Card */}
                            <div className="md:col-span-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-slate-200/50 dark:border-slate-800/50">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Resources & Links</h3>
                                    {!isReadOnly && !isAddingLink && (
                                        <button onClick={() => setIsAddingLink(true)} className="text-green-600 hover:text-green-700 bg-green-50 dark:bg-green-900/30 p-1 rounded-md">
                                            <Plus size={16} />
                                        </button>
                                    )}
                                </div>

                                {isAddingLink && (
                                    <form onSubmit={handleAddLink} className="mb-4 space-y-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <input type="text" placeholder="Display Name (e.g. Google Drive)" value={newLinkName} onChange={(e) => setNewLinkName(e.target.value)} required className="w-full text-sm px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                        <input type="url" placeholder="URL (https://...)" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} required className="w-full text-sm px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                        <div className="flex justify-end gap-2 pt-1">
                                            <button type="button" onClick={() => setIsAddingLink(false)} className="text-xs text-slate-500">Cancel</button>
                                            <button type="submit" className="text-xs bg-green-600 text-white px-2 py-1 rounded">Add</button>
                                        </div>
                                    </form>
                                )}

                                <div className="space-y-2">
                                    {project.links.length === 0 && !isAddingLink && (
                                        <p className="text-sm italic text-slate-500">No resources linked.</p>
                                    )}
                                    {project.links.map((link, idx) => (
                                        <div key={idx} className="flex items-center justify-between group bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 hover:underline truncate">
                                                <LinkIcon size={14} className="shrink-0" />
                                                <span className="truncate">{link.displayName}</span>
                                            </a>
                                            {!isReadOnly && (
                                                <button onClick={() => handleDeleteLink(idx)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-1">
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tasks Section */}
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 overflow-hidden">

                        <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <CheckCircle2 className="text-green-500" /> Tasks
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">{tasks.length} total tasks</p>
                            </div>
                            {!isReadOnly && (
                                <button
                                    onClick={() => setIsAddingTask(!isAddingTask)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    {isAddingTask ? <X size={16} /> : <Plus size={16} />}
                                    {isAddingTask ? 'Cancel' : 'Add Task'}
                                </button>
                            )}
                        </div>

                        {/* Add Task Form inline */}
                        {isAddingTask && !isReadOnly && (
                            <div className="p-4 md:p-6 bg-green-50/50 dark:bg-green-900/10 border-b border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-4 fade-in">
                                <form onSubmit={handleAddTask} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Task Title *</label>
                                        <input
                                            type="text"
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            required
                                            placeholder="What needs to be done?"
                                            autoFocus
                                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Priority</label>
                                            <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as any)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white">
                                                <option value="High">High Priority</option>
                                                <option value="Medium">Medium Priority</option>
                                                <option value="Low">Low Priority</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                                            <select value={newTaskCategory} onChange={(e) => setNewTaskCategory(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white">
                                                <option value="">None</option>
                                                {taskCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Scheduled Date</label>
                                            <input type="date" value={newTaskScheduled} onChange={(e) => setNewTaskScheduled(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Deadline</label>
                                            <input type="date" value={newTaskDeadline} onChange={(e) => setNewTaskDeadline(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" />
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <button type="submit" disabled={!newTaskTitle.trim()} className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                                            Save Task
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Task List */}
                        {tasks.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center text-slate-500">
                                <FolderKanban size={48} className="opacity-20 mb-4" />
                                <p>No tasks created yet.</p>
                                {!isReadOnly && <p className="text-sm mt-1">Click "Add Task" to get started.</p>}
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {tasks.map(task => {
                                    const cat = allCategories.find(c => c.id === task.categoryId);
                                    const isCompleted = task.status === 'Completed';

                                    return (
                                        <li key={task.id} className={`group p-4 md:px-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-4 ${isCompleted ? 'opacity-60' : ''}`}>
                                            <button
                                                onClick={() => handleToggleTaskStatus(task)}
                                                disabled={isReadOnly}
                                                className={`mt-1 shrink-0 ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}`}
                                            >
                                                {getStatusIcon(task.status)}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className={`font-semibold text-slate-900 dark:text-white text-sm md:text-base ${isCompleted ? 'line-through text-slate-500 dark:text-slate-400' : ''}`}>
                                                        {task.title}
                                                    </h4>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>
                                                        {task.priority}
                                                    </span>
                                                    {cat && (
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cat.colorClass}`}>
                                                            {cat.name}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    {task.scheduledDateStr && (
                                                        <span className="flex items-center gap-1.5"><CalendarDays size={12} className="text-green-500"/> Scheduled: {new Date(task.scheduledDateStr).toLocaleDateString()}</span>
                                                    )}
                                                    {task.deadlineDateStr && (
                                                        <span className="flex items-center gap-1.5"><Clock size={12} className="text-red-500"/> Due: {new Date(task.deadlineDateStr).toLocaleDateString()}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {!isReadOnly && (
                                                <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete Task">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                    </div>

                </div>
            </div>
        </div>
    );
}