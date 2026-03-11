import React, { useState } from 'react';
import { Project, Category, Task, ProjectLink } from '../types';
import { saveProject, saveTask, deleteTask, fetchIdeas, deleteIdea } from '../services/projectService';
import { generateContentFromAction, extractTaskDetails } from '../services/aiService';
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
    FolderKanban,
    ChevronDown,
    ChevronUp,
    Edit2,
    Bot,
    Lightbulb
} from 'lucide-react';
import { getContrastTextColor } from '../utils/colorUtils';
import { handleTaskRecurrence } from '../utils/taskUtils';
import TaskEditModal from './TaskEditModal';
import AIInsightsPanel from './AIInsightsPanel';
import AIContentModal from './AIContentModal';
import ProjectAskAIModal from './ProjectAskAIModal';
import ReviewTasksModal from './ReviewTasksModal';
import TaskCardModal from './TaskCardModal';
import { Idea } from '../types';

interface ProjectViewProps {
    project: Project;
    allCategories: Category[];
    allTasks: Task[];
    isReadOnly: boolean;
    onBack: () => void;
    onUpdateProject: (updatedProj: Project) => void;
    onTaskUpdate?: () => void;
    onTaskDeleted?: (taskId: string) => void;
    onTaskUpdated?: (task: Task) => void;
    onTaskAdded?: (task: Task) => void;
}

const BACKGROUND_COLORS = [
    { label: 'Default', class: 'bg-gray-50 dark:bg-slate-950' },
    { label: 'Slate', class: 'bg-slate-100 dark:bg-slate-900' },
    { label: 'Zinc', class: 'bg-zinc-50 dark:bg-zinc-900/50' },
    { label: 'Stone', class: 'bg-stone-50 dark:bg-stone-900/50' },
    { label: 'Red', class: 'bg-red-50 dark:bg-red-950/30' },
    { label: 'Orange', class: 'bg-orange-50 dark:bg-orange-950/30' },
    { label: 'Amber', class: 'bg-amber-50 dark:bg-amber-950/30' },
    { label: 'Yellow', class: 'bg-yellow-50 dark:bg-yellow-950/30' },
    { label: 'Lime', class: 'bg-lime-50 dark:bg-lime-950/30' },
    { label: 'Green', class: 'bg-green-50 dark:bg-green-950/30' },
    { label: 'Emerald', class: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Teal', class: 'bg-teal-50 dark:bg-teal-950/30' },
    { label: 'Cyan', class: 'bg-cyan-50 dark:bg-cyan-950/30' },
    { label: 'Sky', class: 'bg-sky-50 dark:bg-sky-950/30' },
    { label: 'Blue', class: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Indigo', class: 'bg-indigo-50 dark:bg-indigo-950/30' },
    { label: 'Violet', class: 'bg-violet-50 dark:bg-violet-950/30' },
    { label: 'Purple', class: 'bg-purple-50 dark:bg-purple-950/30' },
    { label: 'Fuchsia', class: 'bg-fuchsia-50 dark:bg-fuchsia-950/30' },
    { label: 'Pink', class: 'bg-pink-50 dark:bg-pink-950/30' },
    { label: 'Rose', class: 'bg-rose-50 dark:bg-rose-950/30' },
    { label: 'Deep Green', class: 'bg-green-100 dark:bg-green-900/50' },
    { label: 'Deep Blue', class: 'bg-blue-100 dark:bg-blue-900/50' },
    { label: 'Deep Purple', class: 'bg-purple-100 dark:bg-purple-900/50' },
];

type ViewMode = 'list' | 'timeline' | 'matrix' | 'ideas';

export default function ProjectView({ project, allCategories, allTasks, isReadOnly, onBack, onUpdateProject, onTaskUpdate, onTaskDeleted, onTaskUpdated, onTaskAdded }: ProjectViewProps) {
    const [tasks, setTasks] = useState<Task[]>(allTasks);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [isEditingSettings, setIsEditingSettings] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    // Idea Conversion State
    const [convertingIdea, setConvertingIdea] = useState<Idea | null>(null);
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

    React.useEffect(() => {
        const loadIdeas = async () => {
            try {
                const allIdeas = await fetchIdeas();
                setIdeas(allIdeas.filter(i => i.projectId === project.id));
            } catch (e) {
                console.error("Failed to load ideas", e);
            }
        };
        loadIdeas();
    }, [project.id]);

    // Edit Settings State
    const [editName, setEditName] = useState(project.name);
    const [editDesc, setEditDesc] = useState(project.description || '');
    const [editBgColor, setEditBgColor] = useState(project.colorClass || BACKGROUND_COLORS[0].class);
    const [editCategory, setEditCategory] = useState(project.categoryId || '');
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

    // New Link State
    const [isAddingLink, setIsAddingLink] = useState(false);
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [newLinkName, setNewLinkName] = useState('');

    // Task Expansion State
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

    // New Subtask State
    const [addingSubtaskId, setAddingSubtaskId] = useState<string | null>(null);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [newSubtaskDescription, setNewSubtaskDescription] = useState('');
    const [newSubtaskPriority, setNewSubtaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
    const [newSubtaskCategory, setNewSubtaskCategory] = useState('');
    const [newSubtaskScheduled, setNewSubtaskScheduled] = useState('');
    const [newSubtaskDeadline, setNewSubtaskDeadline] = useState('');

    // New Task State
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

    const toggleTaskSelection = (taskId: string, e: React.MouseEvent | React.ChangeEvent) => {
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
            try {
                await deleteTask(id);
                if (onTaskDeleted) onTaskDeleted(id);
            } catch (e) { console.error("Failed to delete task in bulk", id, e); }
        }
        onTaskUpdate();
    };

    const handleBulkComplete = async () => {
        const idsToUpdate = Array.from(selectedTaskIds);
        setSelectedTaskIds(new Set());
        const flatTasks = tasks;
        for (const id of idsToUpdate) {
            const task = flatTasks.find(t => t.id === id);
            if (task && task.status !== 'Completed') {
                try {
                    const updatedTask = { ...task, status: 'Completed' as const, completedAt: Date.now() };
                    await saveTask(updatedTask);
            if (onTaskUpdated) onTaskUpdated(updatedTask);
                    if (onTaskUpdated) onTaskUpdated(updatedTask);
                } catch (e) { console.error("Failed to complete task in bulk", id, e); }
            }
        }
        onTaskUpdate();
    };

    const [aiTaskInput, setAiTaskInput] = useState('');
    const [isGeneratingTask, setIsGeneratingTask] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
    const [newTaskCategory, setNewTaskCategory] = useState('');
    const [newTaskScheduled, setNewTaskScheduled] = useState('');
    const [newTaskDeadline, setNewTaskDeadline] = useState('');

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [editingParentTask, setEditingParentTask] = useState<Task | null>(null);

    // AI Content Modal State
    const [aiContentModalOpen, setAiContentModalOpen] = useState(false);
    const [selectedAiContent, setSelectedAiContent] = useState<string | null>(null);
    const [selectedAiTaskTitle, setSelectedAiTaskTitle] = useState('');
    const [selectedAiTaskId, setSelectedAiTaskId] = useState<string | null>(null);

    // Review Tasks Modal State
    const [reviewTasksModalOpen, setReviewTasksModalOpen] = useState(false);

    // Project Ask AI Modal State
    const [isAskAiModalOpen, setIsAskAiModalOpen] = useState(false);

    // Task Card Modal State
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [cardTask, setCardTask] = useState<Task | null>(null);

    const openCardModal = (task: Task, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setCardTask(task);
        setIsCardModalOpen(true);
    };

    // Sorting & Visibility State
    const [uncompletedSortBy, setUncompletedSortBy] = useState<'createdAt' | 'deadlineDateStr' | 'alphabetical' | 'priority'>('createdAt');
    const [completedSortBy, setCompletedSortBy] = useState<'completedAt' | 'createdAt' | 'deadlineDateStr' | 'alphabetical' | 'priority'>('completedAt');
    const [isCompletedSectionOpen, setIsCompletedSectionOpen] = useState(false);

    const taskCategories = allCategories.filter(c => c.type === 'task');
    const projectCategory = allCategories.find(c => c.id === project.categoryId);

    // --- Handlers ---

    const handleDeleteIdea = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (isReadOnly) return;
        try {
            await deleteIdea(id);
            setIdeas(prev => prev.filter(i => i.id !== id));
        } catch (e) {
            console.error("Failed to delete idea", e);
        }
    };

    const handleConvertIdeaToTask = (idea: Idea) => {
        setConvertingIdea(idea);
        setIsConvertModalOpen(true);
    };

    const handleSaveConvertedTask = async (task: Task) => {
        if (isReadOnly || !convertingIdea) return;
        try {
            await saveTask(task);
            await deleteIdea(convertingIdea.id);

            setTasks(prev => [task, ...prev]);
            setIdeas(prev => prev.filter(i => i.id !== convertingIdea.id));
        } catch (e) {
            console.error("Failed to convert idea to task", e);
        } finally {
            setIsConvertModalOpen(false);
            setConvertingIdea(null);
        }
    };

    const toggleTaskExpansion = (taskId: string) => {
        setExpandedTasks(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    };

    const handleGenerateDescription = async () => {
        if (isReadOnly) return;
        setIsGeneratingDesc(true);
        try {
            const prompt = `Write a professional, concise project description for a school project titled "${project.name}".
            Here are the current tasks associated with this project:
            ${tasks.map(t => `- ${t.title}`).join('\n')}
            Keep it to 2-3 sentences max. Do not use markdown formatting.`;
            const result = await generateContentFromAction(prompt);
            setEditDesc(result);
        } catch (e) {
            console.error("Failed to generate description:", e);
        } finally {
            setIsGeneratingDesc(false);
        }
    };

    const handleSaveSettings = async () => {
        if (isReadOnly) return;
        if (!editName.trim()) {
            alert("Project name cannot be empty.");
            return;
        }
        const updated = { ...project, name: editName.trim(), description: editDesc, colorClass: editBgColor, categoryId: editCategory || undefined };
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

    const handleAiTaskExtract = async () => {
        if (!aiTaskInput.trim()) return;
        setIsGeneratingTask(true);
        try {
            const details = await extractTaskDetails(aiTaskInput, [project], []);
            if (details.title) setNewTaskTitle(details.title);
            if (details.description) setNewTaskDescription(details.description);
            if (details.priority) setNewTaskPriority(details.priority as any);
            if (details.scheduledDateStr) setNewTaskScheduled(details.scheduledDateStr);
            if (details.deadlineDateStr) setNewTaskDeadline(details.deadlineDateStr);
            setAiTaskInput('');
        } catch (e) {
            console.error("Failed to extract task details:", e);
        } finally {
            setIsGeneratingTask(false);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly || !newTaskTitle.trim()) return;

        const isGeneral = project.id.startsWith('__general_');
        const newTask: Task = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            projectId: isGeneral ? '' : project.id,
            categoryId: isGeneral ? project.categoryId : (newTaskCategory || undefined),
            title: newTaskTitle.trim(),
            description: newTaskDescription.trim() || undefined,
            status: 'Uncompleted',
            priority: newTaskPriority,
            scheduledDateStr: newTaskScheduled || undefined,
            deadlineDateStr: newTaskDeadline || undefined,
            subtasks: [],
            createdAt: Date.now()
        };

        try {
            await saveTask(newTask);
            setTasks([newTask, ...tasks]);
            if (onTaskAdded) onTaskAdded(newTask);
            setIsAddingTask(false);
            // Reset form
            setNewTaskTitle('');
            setNewTaskDescription('');
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

        let updated: Task = { ...task, status: nextStatus };
        if (nextStatus === 'Completed') {
            updated.completedAt = Date.now();
        } else {
            updated.completedAt = undefined;
        }

        if (nextStatus === 'Completed' && updated.recurrenceType) {
            updated = handleTaskRecurrence(updated);
        }

        // Optimistic UI
        setTasks(tasks.map(t => t.id === task.id ? updated : t));
        if (cardTask?.id === task.id) {
            setCardTask(updated);
        }

        try {
            await saveTask(updated);
            if (onTaskUpdated) onTaskUpdated(updated);
        } catch (e) {
            console.error(e);
            // Revert
            setTasks(tasks.map(t => t.id === task.id ? task : t));
            if (cardTask?.id === task.id) {
                setCardTask(task);
            }
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (isReadOnly) return;
        if (window.confirm("Are you sure you want to delete this task?")) {
            try {
                await deleteTask(taskId);
                if (onTaskDeleted) onTaskDeleted(taskId);
                if (onTaskDeleted) onTaskDeleted(taskId);
                setTasks(tasks.filter(t => t.id !== taskId));
            } catch (e) {
                console.error(e);
                alert("Failed to delete task.");
            }
        }
    };

    const handleAddSubtask = async (e: React.FormEvent, parentTask: Task) => {
        e.preventDefault();
        if (isReadOnly || !newSubtaskTitle.trim()) return;

        const subtask: Task = {
            id: `subtask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            projectId: parentTask.projectId.startsWith('__general_') ? '' : parentTask.projectId,
            title: newSubtaskTitle.trim(),
            description: newSubtaskDescription.trim() || undefined,
            status: 'Uncompleted',
            priority: newSubtaskPriority,
            categoryId: newSubtaskCategory || undefined,
            scheduledDateStr: newSubtaskScheduled || undefined,
            deadlineDateStr: newSubtaskDeadline || undefined,
            createdAt: Date.now()
        };

        const currentSubtasks = parentTask.subtasks || [];
        const updatedParent = {
            ...parentTask,
            subtasks: [...currentSubtasks, subtask]
        };

        try {
            await saveTask(updatedParent);
            setTasks(tasks.map(t => t.id === parentTask.id ? updatedParent : t));
            setAddingSubtaskId(null);
            setNewSubtaskTitle('');
            setNewSubtaskDescription('');
            setNewSubtaskPriority('Medium');
            setNewSubtaskCategory('');
            setNewSubtaskScheduled('');
            setNewSubtaskDeadline('');
        } catch (e) {
            console.error(e);
            alert("Failed to add subtask.");
        }
    };

    const handleToggleSubtaskStatus = async (parentTask: Task, subtaskId: string) => {
        if (isReadOnly) return;

        const currentSubtasks = parentTask.subtasks || [];
        const updatedSubtasks = currentSubtasks.map(st => {
            if (st.id === subtaskId) {
                const nextStatus: Task['status'] = st.status === 'Completed' ? 'Uncompleted' : 'Completed';
                const stUpdated = { ...st, status: nextStatus };
                if (nextStatus === 'Completed') {
                    stUpdated.completedAt = Date.now();
                } else {
                    stUpdated.completedAt = undefined;
                }
                return stUpdated;
            }
            return st;
        });

        const updatedParent = { ...parentTask, subtasks: updatedSubtasks };
        setTasks(tasks.map(t => t.id === parentTask.id ? updatedParent : t));
        if (cardTask?.id === parentTask.id) {
            setCardTask(updatedParent);
        }

        try {
            await saveTask(updatedParent);
        } catch (e) {
            console.error(e);
            setTasks(tasks.map(t => t.id === parentTask.id ? parentTask : t)); // Revert
            if (cardTask?.id === parentTask.id) {
                setCardTask(parentTask);
            }
        }
    };

    const handleDeleteSubtask = async (parentTask: Task, subtaskId: string) => {
        if (isReadOnly) return;

        const currentSubtasks = parentTask.subtasks || [];
        const updatedSubtasks = currentSubtasks.filter(st => st.id !== subtaskId);
        const updatedParent = { ...parentTask, subtasks: updatedSubtasks };

        setTasks(tasks.map(t => t.id === parentTask.id ? updatedParent : t));

        try {
            await saveTask(updatedParent);
        } catch (e) {
            console.error(e);
            alert("Failed to delete subtask.");
            setTasks(tasks.map(t => t.id === parentTask.id ? parentTask : t)); // Revert
        }
    };

    const handleEditTaskSave = async (updatedTask: Task) => {
        if (isReadOnly) return;

        try {
            if (editingParentTask) {
                // We are editing a subtask
                const updatedSubtasks = editingParentTask.subtasks?.map(st =>
                    st.id === updatedTask.id ? updatedTask : st
                ) || [];
                const updatedParent = { ...editingParentTask, subtasks: updatedSubtasks };

                await saveTask(updatedParent);
                setTasks(tasks.map(t => t.id === updatedParent.id ? updatedParent : t));
            } else {
                // We are editing a top-level task
                await saveTask(updatedTask);
            if (onTaskUpdated) onTaskUpdated(updatedTask);
            if (onTaskUpdated) onTaskUpdated(updatedTask);
                setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
            }
        } catch (e) {
            console.error("Failed to save edited task", e);
            alert("Failed to save changes.");
        } finally {
            setEditingTask(null);
            setEditingParentTask(null);
        }
    };

    const openEditModal = (task: Task, parentTask: Task | null = null) => {
        setEditingTask(task);
        setEditingParentTask(parentTask);
        setIsEditModalOpen(true);
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

    // Matrix View
    const renderMatrixView = () => {
        const isUrgent = (task: Task) => {
            if (!task.deadlineDateStr && !task.scheduledDateStr) return false;
            const targetDate = task.deadlineDateStr ? new Date(task.deadlineDateStr) : new Date(task.scheduledDateStr!);
            const now = new Date();
            const daysDiff = (targetDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
            return daysDiff <= 7;
        };

        // Flatten tasks to include subtasks
        const allFlattenedTasks: Task[] = [];
        tasks.forEach(t => {
            allFlattenedTasks.push(t);
            if (t.subtasks && t.subtasks.length > 0) {
                t.subtasks.forEach(st => {
                    // Inject parent info into subtask for display
                    allFlattenedTasks.push({
                        ...st,
                        categoryId: t.categoryId,
                        title: `↳ ${st.title} (Subtask of ${t.title})`
                    });
                });
            }
        });

        const q1 = allFlattenedTasks.filter(t => t.status !== 'Completed' && t.priority === 'High' && isUrgent(t));
        const q2 = allFlattenedTasks.filter(t => t.status !== 'Completed' && t.priority === 'High' && !isUrgent(t));
        const q3 = allFlattenedTasks.filter(t => t.status !== 'Completed' && t.priority !== 'High' && isUrgent(t));
        const q4 = allFlattenedTasks.filter(t => t.status !== 'Completed' && t.priority !== 'High' && !isUrgent(t));
        const completed = allFlattenedTasks.filter(t => t.status === 'Completed');

        const TaskCard = ({ task }: { task: Task }) => {
            const cat = allCategories.find(c => c.id === task.categoryId);
            const subtasks = task.subtasks || [];
            const completedSubtasks = subtasks.filter(st => st.status === 'Completed').length;
            const hasSubtasks = subtasks.length > 0;
            const bgColorClass = project?.colorClass || 'bg-white dark:bg-slate-800';



    return (
                <div onClick={(e) => openCardModal(task, e)} className={`cursor-pointer group p-3 ${bgColorClass} rounded-lg shadow-sm border flex flex-col gap-2 relative`}>
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                            <input
                                type="checkbox"
                                checked={selectedTaskIds.has(task.id)}
                                onChange={(e) => toggleTaskSelection(task.id, e as any)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1.5 shrink-0 w-4 h-4 text-green-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-green-500 cursor-pointer"
                            />
                            <button onClick={(e) => { e.stopPropagation(); handleToggleTaskStatus(task); }} disabled={isReadOnly} className={`mt-0.5 shrink-0 ${isReadOnly ? '' : 'hover:scale-110'}`}>
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
                        <span className={`px-1.5 py-0.5 rounded uppercase tracking-wider font-bold border ${getPriorityColor(task.priority)}`}>
                            {task.priority}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-[600px] mt-4">
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

                {/* Completed Tasks (Full Width) */}
                {completed.length > 0 && (
                    <div className="md:col-span-2 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col">
                        <h3 className="font-bold text-slate-600 dark:text-slate-400 mb-4 flex items-center justify-between">
                            <span>Completed</span>
                            <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs">{completed.length}</span>
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 opacity-60 hover:opacity-100 transition-opacity">
                            {completed.map(t => <TaskCard key={t.id} task={t} />)}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Timeline View
    const renderTimelineView = () => {
        // Flatten tasks to include subtasks
        const allFlattenedTasks: Task[] = [];
        tasks.forEach(t => {
            allFlattenedTasks.push(t);
            if (t.subtasks && t.subtasks.length > 0) {
                t.subtasks.forEach(st => {
                    // Inject parent info into subtask for display
                    allFlattenedTasks.push({
                        ...st,
                        categoryId: t.categoryId,
                        title: `↳ ${st.title} (Subtask of ${t.title})`
                    });
                });
            }
        });

        const uncompletedTasks = allFlattenedTasks.filter(t => t.status !== 'Completed');
        const completedTasks = allFlattenedTasks.filter(t => t.status === 'Completed');

        const sortedTasks = [...uncompletedTasks].sort((a, b) => {
            const dateA = a.deadlineDateStr || a.scheduledDateStr || '9999-12-31';
            const dateB = b.deadlineDateStr || b.scheduledDateStr || '9999-12-31';
            return new Date(dateA).getTime() - new Date(dateB).getTime();
        });

        const groups: Record<string, Task[]> = {};
        sortedTasks.forEach(task => {
            const dateStr = task.deadlineDateStr || task.scheduledDateStr;
            const groupKey = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unscheduled';
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(task);
        });

        const sortedCompletedTasks = [...completedTasks].sort((a, b) => {
            const dateA = a.deadlineDateStr || a.scheduledDateStr || '9999-12-31';
            const dateB = b.deadlineDateStr || b.scheduledDateStr || '9999-12-31';
            return new Date(dateA).getTime() - new Date(dateB).getTime();
        });

        const completedGroups: Record<string, Task[]> = {};
        sortedCompletedTasks.forEach(task => {
            const dateStr = task.deadlineDateStr || task.scheduledDateStr;
            const groupKey = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unscheduled';
            if (!completedGroups[groupKey]) completedGroups[groupKey] = [];
            completedGroups[groupKey].push(task);
        });

        return (
            <div className="max-w-4xl mx-auto py-8">
                {Object.keys(groups).length === 0 && Object.keys(completedGroups).length === 0 ? (
                    <p className="text-center text-slate-500 py-12">No tasks found.</p>
                ) : (
                    <div className="space-y-12">
                        {Object.entries(groups).map(([month, monthTasks]) => (
                            <div key={month} className="relative">
                                <div className="absolute left-[27px] top-8 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-800 -z-10"></div>

                                <h3 className="sticky top-0 z-10 bg-gray-50/90 dark:bg-slate-950/90 backdrop-blur-sm py-2 text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                                    <div className="w-14 h-14 bg-white dark:bg-slate-900 border-4 border-gray-50 dark:border-slate-950 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 shadow-sm shrink-0">
                                        <CalendarDays size={20} />
                                    </div>
                                    {month}
                                </h3>

                                <div className="mt-6 space-y-6 ml-16">
                                    {monthTasks.map(task => {
                                        const cat = allCategories.find(c => c.id === task.categoryId);
                                        const isCompleted = task.status === 'Completed';
                                        const dateStr = task.deadlineDateStr || task.scheduledDateStr;
                                        const subtasks = task.subtasks || [];
                                        const completedSubtasks = subtasks.filter(st => st.status === 'Completed').length;
                                        const hasSubtasks = subtasks.length > 0;
                                        const bgColorClass = project?.colorClass || 'bg-white dark:bg-slate-900';

                                        return (
                                            <div key={task.id} onClick={(e) => openCardModal(task, e)} className={`cursor-pointer ${bgColorClass} p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 transition-opacity ${isCompleted ? 'opacity-50' : ''}`}>
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

                                                <div className="flex-1 flex items-start justify-between gap-3 group/task">
                                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                            <input
                                type="checkbox"
                                checked={selectedTaskIds.has(task.id)}
                                onChange={(e) => toggleTaskSelection(task.id, e as any)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1.5 shrink-0 w-4 h-4 text-green-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-green-500 cursor-pointer"
                            />
                                                        <button onClick={(e) => { e.stopPropagation(); handleToggleTaskStatus(task); }} disabled={isReadOnly} className={`mt-0.5 shrink-0 ${isReadOnly ? '' : 'hover:scale-110'}`}>
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

                        {Object.keys(completedGroups).length > 0 && (
                            <div className="mt-16 pt-8 border-t-2 border-dashed border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100 transition-opacity">
                                <h2 className="text-xl font-bold text-slate-600 dark:text-slate-400 mb-8 flex items-center gap-2">
                                    <CheckCircle2 size={24} /> Completed Timeline
                                </h2>
                                <div className="space-y-12">
                                    {Object.entries(completedGroups).map(([month, monthTasks]) => (
                                        <div key={month} className="relative">
                                            <div className="absolute left-[27px] top-8 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-800 -z-10"></div>

                                            <h3 className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm py-2 text-lg font-bold text-slate-500 dark:text-slate-400 flex items-center gap-3">
                                                <div className="w-14 h-14 bg-white dark:bg-slate-900 border-4 border-slate-50 dark:border-slate-900 rounded-full flex items-center justify-center text-slate-400 shadow-sm shrink-0">
                                                    <CalendarDays size={20} />
                                                </div>
                                                {month}
                                            </h3>

                                            <div className="mt-6 space-y-6 ml-16">
                                                {monthTasks.map(task => {
                                                    const cat = allCategories.find(c => c.id === task.categoryId);
                                                    const isCompleted = task.status === 'Completed';
                                                    const dateStr = task.deadlineDateStr || task.scheduledDateStr;
                                                    const subtasks = task.subtasks || [];
                                                    const completedSubtasks = subtasks.filter(st => st.status === 'Completed').length;
                                                    const hasSubtasks = subtasks.length > 0;
                                                    const bgColorClass = project?.colorClass || 'bg-white dark:bg-slate-900';

                                                    return (
                                                        <div key={task.id} onClick={(e) => openCardModal(task, e)} className={`cursor-pointer ${bgColorClass} p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 transition-opacity ${isCompleted ? 'opacity-50' : ''}`}>
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

                                                            <div className="flex-1 flex items-start justify-between gap-3 group/task">
                                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedTaskIds.has(task.id)}
                                                                        onChange={(e) => toggleTaskSelection(task.id, e as any)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="mt-1.5 shrink-0 w-4 h-4 text-green-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-green-500 cursor-pointer"
                                                                    />
                                                                    <button onClick={(e) => { e.stopPropagation(); handleToggleTaskStatus(task); }} disabled={isReadOnly} className={`mt-0.5 shrink-0 ${isReadOnly ? '' : 'hover:scale-110'}`}>
                                                                        {getStatusIcon(task.status)}
                                                                    </button>

                                                                    <div className="flex-1 min-w-0">
                                                                    <h4 className={`font-semibold text-lg text-slate-900 dark:text-white leading-tight mb-2 ${isCompleted ? 'line-through text-slate-500' : ''}`}>
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
                                                                                    setAiContentModalOpen(true);
                                                                                }}
                                                                                className="text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                                                            >
                                                                                <Bot size={10} /> View AI Content
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center gap-2 text-xs grayscale">
                                                                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                                                                            {task.priority} Priority
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
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`flex flex-col h-full overflow-hidden transition-colors duration-300 ${project.colorClass || 'bg-gray-50 dark:bg-slate-950'}`}>

            {/* Header Area */}
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-800/50 p-4 md:px-8 shrink-0 flex items-center justify-between z-10 sticky top-0 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className={`p-2 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors shadow-sm ${project.colorClass ? getContrastTextColor(project.colorClass) : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className={`text-xl md:text-2xl font-bold truncate ${project.colorClass ? getContrastTextColor(project.colorClass) : 'text-slate-800 dark:text-white'}`}>{project.name}</h1>
                            {projectCategory && (
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold border whitespace-nowrap ${projectCategory.colorClass} ${getContrastTextColor(projectCategory.colorClass)}`}>
                                    {projectCategory.name}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {!isReadOnly && (
                        <button
                            onClick={() => setIsAskAiModalOpen(true)}
                            className="p-2 rounded-lg transition-colors border shadow-sm flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                        >
                            <Bot size={18} /> <span className="hidden sm:inline text-sm font-medium">Ask AI / Upload</span>
                        </button>
                    )}
                    {!isReadOnly && (
                        <button
                            onClick={() => setIsEditingSettings(!isEditingSettings)}
                            className={`p-2 rounded-lg transition-colors border shadow-sm flex items-center gap-2 ${isEditingSettings ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                        >
                            <Settings size={18} /> <span className="hidden sm:inline text-sm font-medium">Project Settings</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-6">

                    <AIInsightsPanel
                        contextType="project"
                        project={project}
                        tasks={tasks}
                        isReadOnly={isReadOnly}
                        onTaskUpdate={() => {}} // Will be handled by state refresh if needed, or optimistic updates
                    />

                    {/* Top Section: Settings / Description & Links */}
                    {isEditingSettings ? (
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                            <h3 className="text-lg font-bold mb-4">Project Settings</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project Name</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                                        {!isReadOnly && (
                                            <button
                                                type="button"
                                                onClick={handleGenerateDescription}
                                                disabled={isGeneratingDesc}
                                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                                            >
                                                <Bot size={14} /> {isGeneratingDesc ? 'Generating...' : 'Generate with AI'}
                                            </button>
                                        )}
                                    </div>
                                    <textarea
                                        value={editDesc}
                                        onChange={(e) => setEditDesc(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm min-h-[100px] text-slate-900 dark:text-white"
                                        placeholder="Add notes or a description here..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                                    <select
                                        value={editCategory}
                                        onChange={(e) => setEditCategory(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                    >
                                        <option value="">No Category</option>
                                        {allCategories.filter(c => c.type === 'project').map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
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
                            <div className="flex flex-wrap items-center gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <CheckCircle2 className="text-green-500" /> Tasks & Ideas
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">{tasks.length} tasks • {ideas.length} ideas</p>
                                </div>

                                <div className="hidden sm:flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                                    <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>List</button>
                                    <button onClick={() => setViewMode('matrix')} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'matrix' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Matrix</button>
                                    <button onClick={() => setViewMode('timeline')} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'timeline' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Timeline</button>
                                    <button onClick={() => setViewMode('ideas')} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'ideas' ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                                        <Lightbulb size={12} /> Ideas
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {viewMode === 'list' && (
                                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                        <span className="text-[10px] uppercase font-semibold text-slate-500 hidden md:inline">Sort Active:</span>
                                        <select
                                            value={uncompletedSortBy}
                                            onChange={(e) => setUncompletedSortBy(e.target.value as any)}
                                            className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                                        >
                                            <option value="createdAt">Date Created</option>
                                            <option value="deadlineDateStr">Due Date</option>
                                            <option value="priority">Priority</option>
                                            <option value="alphabetical">Alphabetical</option>
                                        </select>
                                    </div>
                                )}
                                <div className="sm:hidden flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg flex-wrap">
                                    <button onClick={() => setViewMode('list')} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>List</button>
                                    <button onClick={() => setViewMode('matrix')} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'matrix' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Matrix</button>
                                    <button onClick={() => setViewMode('timeline')} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'timeline' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Timeline</button>
                                    <button onClick={() => setViewMode('ideas')} className={`px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'ideas' ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                                        <Lightbulb size={10} />
                                    </button>
                                </div>

                                {!isReadOnly && viewMode !== 'ideas' && (
                                    <button
                                        onClick={() => setIsAddingTask(!isAddingTask)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                                    >
                                        {isAddingTask ? <X size={16} /> : <Plus size={16} />}
                                        <span className="hidden sm:inline">{isAddingTask ? 'Cancel' : 'Add Task'}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Add Task Form inline */}
                        {isAddingTask && !isReadOnly && (
                            <div className="p-4 md:p-6 bg-green-50/50 dark:bg-green-900/10 border-b border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-4 fade-in">
                                <form onSubmit={handleAddTask} className="space-y-4">
                                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/50 rounded-lg p-3 mb-4 flex items-center gap-3">
                                        <Bot className="text-blue-500 shrink-0" size={20} />
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={aiTaskInput}
                                                onChange={(e) => setAiTaskInput(e.target.value)}
                                                placeholder="Describe task naturally (e.g., 'Grade papers tomorrow high priority')"
                                                className="w-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg pl-3 pr-24 py-2 text-sm focus:ring-2 focus:ring-blue-500"
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
                                                disabled={!aiTaskInput.trim() || isGeneratingTask}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-3 py-1 rounded-md transition-colors"
                                            >
                                                {isGeneratingTask ? 'Extracting...' : 'Extract'}
                                            </button>
                                        </div>
                                    </div>

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
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description / Notes</label>
                                        <textarea
                                            value={newTaskDescription}
                                            onChange={(e) => setNewTaskDescription(e.target.value)}
                                            placeholder="Add details, notes, or steps..."
                                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 min-h-[80px]"
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

                        {/* Task List / Views */}
                        {viewMode === 'ideas' ? (
                            <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900/50 min-h-[400px]">
                                {ideas.length === 0 ? (
                                    <div className="text-center text-slate-400 dark:text-slate-500 mt-10">
                                        <Lightbulb size={40} className="mx-auto mb-3 opacity-20" />
                                        <p>No ideas for this project yet.</p>
                                        <p className="text-sm">Use the Quick Add button to jot down ideas.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {ideas.map(idea => (
                                            <div key={idea.id} className="bg-amber-50 dark:bg-slate-800 border border-amber-100 dark:border-slate-700 p-4 rounded-xl shadow-sm flex flex-col group">
                                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap flex-1">{idea.text}</p>
                                                <div className="flex justify-between items-center mt-4 pt-3 border-t border-amber-200/50 dark:border-slate-700">
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {new Date(idea.createdAt).toLocaleDateString()}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        {!isReadOnly && (
                                                            <>
                                                                <button onClick={(e) => handleDeleteIdea(idea.id, e)} className="p-1.5 text-slate-400 hover:text-red-500 rounded bg-white dark:bg-slate-900 shadow-sm transition-colors" title="Delete Idea">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                                <button onClick={() => handleConvertIdeaToTask(idea)} className="px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded shadow-sm transition-colors flex items-center gap-1">
                                                                    Convert to Task
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center text-slate-500">
                                <FolderKanban size={48} className="opacity-20 mb-4" />
                                <p>No tasks created yet.</p>
                                {!isReadOnly && <p className="text-sm mt-1">Click "Add Task" to get started.</p>}
                            </div>
                        ) : viewMode === 'matrix' ? (
                            <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900/50">
                                {renderMatrixView()}
                            </div>
                        ) : viewMode === 'timeline' ? (
                            <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900/50">
                                {renderTimelineView()}
                            </div>
                        ) : (
                            <>
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(() => {
                                    const uncompletedTasks = tasks.filter(t => t.status !== 'Completed');
                                    uncompletedTasks.sort((a, b) => {
                                        if (uncompletedSortBy === 'createdAt') return (b.createdAt || 0) - (a.createdAt || 0);
                                        if (uncompletedSortBy === 'deadlineDateStr') {
                                            if (!a.deadlineDateStr) return 1;
                                            if (!b.deadlineDateStr) return -1;
                                            return new Date(a.deadlineDateStr).getTime() - new Date(b.deadlineDateStr).getTime();
                                        }
                                        if (uncompletedSortBy === 'alphabetical') return a.title.localeCompare(b.title);
                                        if (uncompletedSortBy === 'priority') {
                                            const pMap = { High: 3, Medium: 2, Low: 1 };
                                            return (pMap[b.priority || 'Medium'] || 0) - (pMap[a.priority || 'Medium'] || 0);
                                        }
                                        return 0;
                                    });

                                    if (uncompletedTasks.length === 0) {
                                        return <div className="p-8 text-center text-slate-500 italic">No active tasks.</div>;
                                    }

                                    return uncompletedTasks.map(task => {
                                    const cat = allCategories.find(c => c.id === task.categoryId);
                                    const isCompleted = task.status === 'Completed';
                                    const isExpanded = expandedTasks.has(task.id);

                                    const subtasks = task.subtasks || [];
                                    const completedSubtasks = subtasks.filter(st => st.status === 'Completed').length;
                                    const hasSubtasks = subtasks.length > 0;

                                    return (
                                        <li key={task.id} onClick={(e) => openCardModal(task, e)} className={`cursor-pointer group p-4 md:px-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 flex flex-col gap-2 ${isCompleted ? 'opacity-60' : ''}`}>
                                            <div className="flex items-start gap-4">
                            <input
                                type="checkbox"
                                checked={selectedTaskIds.has(task.id)}
                                onChange={(e) => toggleTaskSelection(task.id, e as any)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 shrink-0 w-4 h-4 text-green-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-green-500 cursor-pointer"
                            />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleToggleTaskStatus(task); }}
                                                    disabled={isReadOnly}
                                                    className={`mt-1 shrink-0 ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'} ${task.status === 'Completed' ? 'text-green-500' : task.status === 'In Progress' ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                                                >
                                                    {getStatusIcon(task.status)}
                                                </button>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <h4 className={`font-semibold text-sm md:text-base ${task.status === 'Completed' ? 'line-through text-slate-500 dark:text-slate-400' : task.status === 'In Progress' ? 'text-amber-700 dark:text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                                                            {task.title}
                                                        </h4>

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
                                                                    setAiContentModalOpen(true);
                                                                }}
                                                                className="text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                                            >
                                                                <Bot size={10} /> View AI Content
                                                            </button>
                                                        )}
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

                                            <div className="shrink-0 flex items-center gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); toggleTaskExpansion(task.id); }} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg transition-colors">
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                                {!isReadOnly && (
                                                    <>
                                                        <button onClick={(e) => { e.stopPropagation(); openEditModal(task); }} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Edit Task">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteTask(task.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Delete Task">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="pl-10 pr-2 pb-2 mt-2 space-y-4 animate-in fade-in slide-in-from-top-2">
                                                {task.description && (
                                                    <div className="text-sm text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-200/50 dark:border-slate-800/50 whitespace-pre-wrap">
                                                        {task.description}
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    {subtasks.length > 0 && (
                                                        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Subtasks</h5>
                                                    )}
                                                    {subtasks.map(st => {
                                                        const stCat = allCategories.find(c => c.id === st.categoryId);
                                                        return (
                                                            <div key={st.id} className={`flex items-start gap-3 p-2 hover:bg-white dark:hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-colors group/subtask ${st.status === 'Completed' ? 'opacity-60' : ''}`}>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleToggleSubtaskStatus(task, st.id); }}
                                                                    disabled={isReadOnly}
                                                                    className="mt-0.5 shrink-0"
                                                                >
                                                                    {getStatusIcon(st.status)}
                                                                </button>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                        <span className={`text-sm font-medium ${st.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                            {st.title}
                                                                        </span>
                                                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getPriorityColor(st.priority)}`}>
                                                                            {st.priority}
                                                                        </span>
                                                                        {stCat && (
                                                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${stCat.colorClass}`}>
                                                                                {stCat.name}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {st.description && (
                                                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 whitespace-pre-wrap">
                                                                            {st.description}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex flex-wrap gap-3 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                                        {st.scheduledDateStr && (
                                                                            <span className="flex items-center gap-1"><CalendarDays size={10} className="text-green-500"/> Scheduled: {new Date(st.scheduledDateStr).toLocaleDateString()}</span>
                                                                        )}
                                                                        {st.deadlineDateStr && (
                                                                            <span className="flex items-center gap-1"><Clock size={10} className="text-red-500"/> Due: {new Date(st.deadlineDateStr).toLocaleDateString()}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {!isReadOnly && (
                                                                    <div className="flex gap-1 shrink-0">
                                                                        <button onClick={(e) => { e.stopPropagation(); openEditModal(st, task); }} className="p-1 text-slate-400 hover:text-blue-500 rounded opacity-0 group-hover/subtask:opacity-100 transition-opacity">
                                                                            <Edit2 size={14} />
                                                                        </button>
                                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSubtask(task, st.id); }} className="p-1 text-slate-400 hover:text-red-500 rounded opacity-0 group-hover/subtask:opacity-100 transition-opacity">
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {!isReadOnly && (
                                                        <div className="mt-2">
                                                            {addingSubtaskId === task.id ? (
                                                                <form onSubmit={(e) => handleAddSubtask(e, task)} className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Subtask Title *</label>
                                                                        <input
                                                                            type="text"
                                                                            value={newSubtaskTitle}
                                                                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                                                            required
                                                                            placeholder="What needs to be done?"
                                                                            autoFocus
                                                                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description / Notes</label>
                                                                        <textarea
                                                                            value={newSubtaskDescription}
                                                                            onChange={(e) => setNewSubtaskDescription(e.target.value)}
                                                                            placeholder="Add details, notes, or steps..."
                                                                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 min-h-[60px]"
                                                                        />
                                                                    </div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                                        <div>
                                                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Priority</label>
                                                                            <select value={newSubtaskPriority} onChange={(e) => setNewSubtaskPriority(e.target.value as any)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white">
                                                                                <option value="High">High Priority</option>
                                                                                <option value="Medium">Medium Priority</option>
                                                                                <option value="Low">Low Priority</option>
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                                                                            <select value={newSubtaskCategory} onChange={(e) => setNewSubtaskCategory(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white">
                                                                                <option value="">None</option>
                                                                                {taskCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Scheduled</label>
                                                                            <input type="date" value={newSubtaskScheduled} onChange={(e) => setNewSubtaskScheduled(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Deadline</label>
                                                                            <input type="date" value={newSubtaskDeadline} onChange={(e) => setNewSubtaskDeadline(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" />
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex justify-end gap-2 pt-2">
                                                                        <button type="button" onClick={() => { setAddingSubtaskId(null); setNewSubtaskTitle(''); setNewSubtaskDescription(''); setNewSubtaskPriority('Medium'); setNewSubtaskCategory(''); setNewSubtaskScheduled(''); setNewSubtaskDeadline(''); }} className="text-slate-500 hover:text-slate-700 text-sm px-3 py-1.5 font-medium">Cancel</button>
                                                                        <button type="submit" disabled={!newSubtaskTitle.trim()} className="bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">Save Subtask</button>
                                                                    </div>
                                                                </form>
                                                            ) : (
                                                                <button onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setAddingSubtaskId(task.id);
                                                                    setNewSubtaskTitle('');
                                                                    setNewSubtaskDescription('');
                                                                    setNewSubtaskPriority('Medium');
                                                                    setNewSubtaskCategory('');
                                                                    setNewSubtaskScheduled('');
                                                                    setNewSubtaskDeadline('');
                                                                }} className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 py-1">
                                                                    <Plus size={14} /> Add Subtask
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        </li>
                                    );
                                    });
                                })()}
                            </ul>

                            {(() => {
                                const completedTasks = tasks.filter(t => t.status === 'Completed');
                                if (completedTasks.length === 0) return null;

                                completedTasks.sort((a, b) => {
                                    if (completedSortBy === 'completedAt') return (b.completedAt || 0) - (a.completedAt || 0);
                                    if (completedSortBy === 'createdAt') return (b.createdAt || 0) - (a.createdAt || 0);
                                    if (completedSortBy === 'deadlineDateStr') {
                                        if (!a.deadlineDateStr) return 1;
                                        if (!b.deadlineDateStr) return -1;
                                        return new Date(a.deadlineDateStr).getTime() - new Date(b.deadlineDateStr).getTime();
                                    }
                                    if (completedSortBy === 'alphabetical') return a.title.localeCompare(b.title);
                                    if (completedSortBy === 'priority') {
                                        const pMap = { High: 3, Medium: 2, Low: 1 };
                                        return (pMap[b.priority || 'Medium'] || 0) - (pMap[a.priority || 'Medium'] || 0);
                                    }
                                    return 0;
                                });

                                return (
                                    <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                                        <button
                                            onClick={() => setIsCompletedSectionOpen(!isCompletedSectionOpen)}
                                            className="w-full px-6 py-4 flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 size={16} /> Completed Tasks ({completedTasks.length})
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {isCompletedSectionOpen && (
                                                    <div className="flex items-center gap-2 px-2 py-1 rounded bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                                                        <span className="text-[10px] uppercase font-semibold text-slate-500 hidden md:inline">Sort:</span>
                                                        <select
                                                            value={completedSortBy}
                                                            onChange={(e) => setCompletedSortBy(e.target.value as any)}
                                                            className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                                                        >
                                                            <option value="completedAt">Date Completed</option>
                                                            <option value="createdAt">Date Created</option>
                                                            <option value="deadlineDateStr">Due Date</option>
                                                            <option value="priority">Priority</option>
                                                            <option value="alphabetical">Alphabetical</option>
                                                        </select>
                                                    </div>
                                                )}
                                                {isCompletedSectionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </button>

                                        {isCompletedSectionOpen && (
                                            <ul className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
                                                {completedTasks.map(task => {
                                                    const cat = allCategories.find(c => c.id === task.categoryId);
                                                    const isCompleted = true;
                                                    const isExpanded = expandedTasks.has(task.id);
                                                    const subtasks = task.subtasks || [];
                                                    const completedSubtasks = subtasks.filter(st => st.status === 'Completed').length;
                                                    const hasSubtasks = subtasks.length > 0;

                                                    return (
                                                        <li key={task.id} onClick={(e) => openCardModal(task, e)} className="cursor-pointer group p-4 md:px-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col gap-2 opacity-60 hover:opacity-100">
                                                            <div className="flex items-start gap-4">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedTaskIds.has(task.id)}
                                                                    onChange={(e) => toggleTaskSelection(task.id, e as any)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="mt-2 shrink-0 w-4 h-4 text-green-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-green-500 cursor-pointer"
                                                                />
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleToggleTaskStatus(task); }}
                                                                    disabled={isReadOnly}
                                                                    className={`mt-1 shrink-0 ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'} ${task.status === 'Completed' ? 'text-green-500' : task.status === 'In Progress' ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                                                                >
                                                                    {getStatusIcon(task.status)}
                                                                </button>

                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                        <h4 className={`font-semibold text-sm md:text-base ${task.status === 'Completed' ? 'line-through text-slate-500 dark:text-slate-400' : task.status === 'In Progress' ? 'text-amber-700 dark:text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                                                                            {task.title}
                                                                        </h4>
                                                                        {hasSubtasks && (
                                                                            <span className="text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                                <CheckCircle2 size={10} /> {completedSubtasks}/{subtasks.length}
                                                                            </span>
                                                                        )}
                                                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)} grayscale`}>
                                                                            {task.priority}
                                                                        </span>
                                                                        {cat && (
                                                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cat.colorClass} grayscale`}>
                                                                                {cat.name}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-400 dark:text-slate-500">
                                                                        {task.completedAt && (
                                                                            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-green-600"/> Completed: {new Date(task.completedAt).toLocaleDateString()}</span>
                                                                        )}
                                                                        {task.deadlineDateStr && (
                                                                            <span className="flex items-center gap-1.5"><Clock size={12}/> Due: {new Date(task.deadlineDateStr).toLocaleDateString()}</span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="shrink-0 flex items-center gap-1">
                                                                    <button onClick={(e) => { e.stopPropagation(); toggleTaskExpansion(task.id); }} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg transition-colors">
                                                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                    </button>
                                                                    {!isReadOnly && (
                                                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteTask(task.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Delete Task">
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="pl-10 pr-2 pb-2 mt-2 space-y-4 animate-in fade-in slide-in-from-top-2">
                                                                    {task.description && (
                                                                        <div className="text-sm text-slate-500 dark:text-slate-500 bg-white/30 dark:bg-slate-950/30 p-3 rounded-lg border border-slate-200/30 dark:border-slate-800/30 whitespace-pre-wrap">
                                                                            {task.description}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })()}
                            </>
                        )}

                    </div>

                </div>
            </div>

            <TaskEditModal
                isOpen={isEditModalOpen}
                onClose={() => { setIsEditModalOpen(false); setEditingTask(null); setEditingParentTask(null); }}
                task={editingTask}
                categories={allCategories}
                onSave={handleEditTaskSave}
            />

            <AIContentModal
                isOpen={aiContentModalOpen}
                onClose={() => setAiContentModalOpen(false)}
                content={selectedAiContent}
                title={selectedAiTaskTitle}
                onSave={async (newContent) => {
                    if (isReadOnly || !selectedAiTaskId) return;
                    const task = tasks.find(t => t.id === selectedAiTaskId);
                    if (task) {
                        try {
                            const updatedTask = { ...task, aiGeneratedContent: newContent };
                            await saveTask(updatedTask);
            if (onTaskUpdated) onTaskUpdated(updatedTask);
            if (onTaskUpdated) onTaskUpdated(updatedTask);
                            setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
                            setSelectedAiContent(newContent);
                        } catch (e) {
                            console.error("Failed to save AI content", e);
                            alert("Failed to save changes.");
                        }
                    }
                }}
            />

            <ProjectAskAIModal
                isOpen={isAskAiModalOpen}
                onClose={() => setIsAskAiModalOpen(false)}
                project={project}
                onTaskAdded={(task) => setTasks(prev => [task, ...prev])}
                isReadOnly={isReadOnly}
            />

            <TaskEditModal
                isOpen={isConvertModalOpen}
                onClose={() => { setIsConvertModalOpen(false); setConvertingIdea(null); }}
                task={convertingIdea ? {
                    id: `task_${Date.now()}`,
                    projectId: convertingIdea.projectId || project.id,
                    title: convertingIdea.text.split('\n')[0].substring(0, 50),
                    description: convertingIdea.text,
                    status: 'Uncompleted',
                    priority: 'Medium',
                    createdAt: Date.now()
                } : null}
                categories={allCategories}
                onSave={handleSaveConvertedTask}
            />

            <ReviewTasksModal
                isOpen={reviewTasksModalOpen}
                onClose={() => {
                    setReviewTasksModalOpen(false);
                    setSelectedTaskIds(new Set());
                }}
                tasks={tasks.filter(t => selectedTaskIds.has(t.id))}
                actionType="generic"
                isReadOnly={isReadOnly}
                onTasksUpdated={() => {
                    if (onTaskUpdate) onTaskUpdate();
                }}
            />

            <TaskCardModal
                isOpen={isCardModalOpen}
                onClose={() => { setIsCardModalOpen(false); setCardTask(null); }}
                task={cardTask}
                projects={[project]}
                categories={allCategories}
                isReadOnly={isReadOnly}
                onEdit={(t) => { setIsCardModalOpen(false); openEditModal(t); }}
                onTaskStatusChange={handleToggleTaskStatus}
                onSubtaskStatusChange={handleToggleSubtaskStatus}
            />

            {selectedTaskIds.size > 0 && !isReadOnly && (
                <div className="bulk-action-bar fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white dark:bg-slate-800 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10 fade-in">
                    <span className="text-sm font-medium">{selectedTaskIds.size} selected</span>
                    <div className="w-px h-4 bg-slate-700"></div>
                    <button onClick={() => setReviewTasksModalOpen(true)} className="text-sm hover:text-blue-400 flex items-center gap-1 transition-colors">
                        <Bot size={16} /> Ask AI
                    </button>
                    <button onClick={handleBulkComplete} className="text-sm hover:text-green-400 flex items-center gap-1 transition-colors">
                        <CheckCircle2 size={16} /> Mark Completed
                    </button>
                    <button onClick={handleBulkDelete} className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                        <Trash2 size={16} /> Delete
                    </button>
                </div>
            )}
        </div>
    );
}