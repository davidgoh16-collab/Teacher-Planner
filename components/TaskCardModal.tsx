import React from 'react';
import { Task, Category, Project } from '../types';
import { X, CheckCircle2, Circle, Clock, CalendarDays, Edit2, Bot } from 'lucide-react';
import { getContrastTextColor } from '../utils/colorUtils';

interface TaskCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: Task | null;
    projects: Project[];
    categories: Category[];
    isReadOnly: boolean;
    onEdit: (task: Task) => void;
    onTaskStatusChange: (task: Task) => void;
    onSubtaskStatusChange?: (parentTask: Task, subtaskId: string) => void;
}

const TaskCardModal: React.FC<TaskCardModalProps> = ({
    isOpen,
    onClose,
    task,
    projects,
    categories,
    isReadOnly,
    onEdit,
    onTaskStatusChange,
    onSubtaskStatusChange
}) => {
    if (!isOpen || !task) return null;

    const project = projects.find(p => p.id === task.projectId);
    const category = categories.find(c => c.id === task.categoryId);
    const subtasks = task.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.status === 'Completed').length;
    const hasSubtasks = subtasks.length > 0;

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'High': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
            case 'Medium': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
            case 'Low': return 'text-primary-600 bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400';
            default: return 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Completed': return <CheckCircle2 size={24} className="text-primary-500" />;
            case 'In Progress': return <Clock size={24} className="text-amber-500" />;
            default: return <Circle size={24} className="text-slate-300 dark:text-slate-600" />;
        }
    };

    const getSubtaskStatusIcon = (status: string) => {
        switch (status) {
            case 'Completed': return <CheckCircle2 size={16} className="text-primary-500" />;
            case 'In Progress': return <Clock size={16} className="text-amber-500" />;
            default: return <Circle size={16} className="text-slate-300 dark:text-slate-600" />;
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-black/[0.06] dark:border-white/[0.08] w-full max-w-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-6 py-5 border-b border-black/[0.06] dark:border-white/[0.08] flex justify-between items-start">
                    <div className="flex items-start gap-4">
                        <button
                            onClick={() => onTaskStatusChange(task)}
                            disabled={isReadOnly}
                            className={`mt-1 shrink-0 ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}`}
                        >
                            {getStatusIcon(task.status)}
                        </button>
                        <div>
                            <h2 className={`text-xl font-bold ${task.status === 'Completed' ? 'line-through text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                                {task.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                                <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                                    {task.priority} Priority
                                </span>
                                {project && (
                                    <span className={`px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium`}>
                                        {project.name}
                                    </span>
                                )}
                                {category && (
                                    <span className={`px-2 py-0.5 rounded-full border ${category.colorClass} ${getContrastTextColor(category.colorClass)}`}>
                                        {category.name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0 ml-4">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">

                    {/* Dates */}
                    <div className="flex flex-wrap gap-6 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        {task.scheduledDateStr ? (
                            <span className="flex items-center gap-2">
                                <CalendarDays size={16} className="text-primary-500"/>
                                <span>Scheduled: <span className="text-slate-900 dark:text-white">{new Date(task.scheduledDateStr).toLocaleDateString()}</span></span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-2 opacity-50">
                                <CalendarDays size={16} /> Unscheduled
                            </span>
                        )}
                        {task.deadlineDateStr ? (
                            <span className="flex items-center gap-2">
                                <Clock size={16} className="text-red-500"/>
                                <span>Due: <span className="text-slate-900 dark:text-white">{new Date(task.deadlineDateStr).toLocaleDateString()}</span></span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-2 opacity-50">
                                <Clock size={16} /> No Deadline
                            </span>
                        )}
                        {task.recurrenceType && (
                            <span className="flex items-center gap-2">
                                <span className="text-blue-500">↻</span>
                                <span>Repeats: <span className="text-slate-900 dark:text-white capitalize">{task.recurrenceType}</span></span>
                            </span>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description / Notes</h3>
                        {task.description ? (
                            <div className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 whitespace-pre-wrap leading-relaxed">
                                {task.description}
                            </div>
                        ) : (
                            <p className="text-sm italic text-slate-400">No description provided.</p>
                        )}
                    </div>

                    {/* AI Content */}
                    {task.aiGeneratedContent && (
                        <div>
                            <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Bot size={14} /> AI Generated Content
                            </h3>
                            <div className="text-sm text-slate-700 dark:text-slate-300 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto custom-scrollbar">
                                {task.aiGeneratedContent}
                            </div>
                        </div>
                    )}

                    {/* Subtasks */}
                    {hasSubtasks && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subtasks</h3>
                                <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 size={12} /> {completedSubtasks}/{subtasks.length} Completed
                                </span>
                            </div>

                            <div className="space-y-2">
                                {subtasks.map(st => (
                                    <div key={st.id} onClick={(e) => e.stopPropagation()} className={`flex items-start gap-3 p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors ${st.status === 'Completed' ? 'opacity-60 bg-slate-50 dark:bg-slate-900/50' : ''}`}>
                                        <button
                                            onClick={() => onSubtaskStatusChange && onSubtaskStatusChange(task, st.id)}
                                            disabled={isReadOnly || !onSubtaskStatusChange}
                                            className="mt-0.5 shrink-0"
                                        >
                                            {getSubtaskStatusIcon(st.status)}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className={`text-sm font-medium ${st.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    {st.title}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getPriorityColor(st.priority)}`}>
                                                    {st.priority}
                                                </span>
                                            </div>
                                            {st.description && (
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 whitespace-pre-wrap line-clamp-2">
                                                    {st.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-black/[0.06] dark:border-white/[0.08] flex justify-between items-center gap-3">
                    <div className="text-xs text-slate-400">
                        Created: {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'Unknown'}
                    </div>

                    <div className="flex gap-3">
                        {!isReadOnly && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onEdit(task);
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-sm"
                            >
                                <Edit2 size={16} /> Edit Task Details
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors shadow-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskCardModal;
