import React, { useState, useEffect } from 'react';
import { Task, Category, Project } from '../types';
import { X } from 'lucide-react';

interface TaskEditModalProps {
    projects?: Project[];
    isOpen: boolean;
    onClose: () => void;
    task: Task | null;
    categories: Category[];
    onSave: (updatedTask: Task) => void;
}

const TaskEditModal: React.FC<TaskEditModalProps> = ({ isOpen, onClose, task, categories, projects = [], onSave }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<Task['priority']>('Medium');
    const [categoryId, setCategoryId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [scheduledDateStr, setScheduledDateStr] = useState('');
    const [deadlineDateStr, setDeadlineDateStr] = useState('');
    const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly'>('none');
    const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description || '');
            setPriority(task.priority);
            setCategoryId(task.categoryId || '');
            setProjectId(task.projectId || '');
            setScheduledDateStr(task.scheduledDateStr || '');
            setDeadlineDateStr(task.deadlineDateStr || '');
            setRecurrenceType(task.recurrenceType || 'none');
            setRecurrenceDays(task.recurrenceDays || []);
        }
    }, [task]);

    if (!isOpen || !task) return null;

    const taskCategories = categories.filter(c => c.type === 'task');

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        const updatedTask: Task = {
            ...task,
            projectId: projectId || '',
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            categoryId: categoryId || undefined,
            scheduledDateStr: scheduledDateStr || undefined,
            deadlineDateStr: deadlineDateStr || undefined,
            recurrenceType: recurrenceType !== 'none' ? recurrenceType : undefined,
            recurrenceDays: recurrenceType === 'weekly' ? recurrenceDays : undefined,
        };

        onSave(updatedTask);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Edit {task.subtasks ? 'Task' : 'Subtask'}</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    <form id="editTaskForm" onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description / Notes</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 min-h-[100px]"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {projects && projects.length > 0 && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Project</label>
                                    <select
                                        value={projectId}
                                        onChange={(e) => setProjectId(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                    >
                                        <option value="">General (No Project)</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Priority</label>
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as any)}
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
                                    value={categoryId}
                                    onChange={(e) => setCategoryId(e.target.value)}
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
                                    value={scheduledDateStr}
                                    onChange={(e) => setScheduledDateStr(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Deadline Date</label>
                                <input
                                    type="date"
                                    value={deadlineDateStr}
                                    onChange={(e) => setDeadlineDateStr(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Recurrence</label>
                                <select
                                    value={recurrenceType}
                                    onChange={(e) => {
                                        setRecurrenceType(e.target.value as any);
                                        if (e.target.value !== 'weekly') setRecurrenceDays([]);
                                    }}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                >
                                    <option value="none">Does not repeat</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                </select>
                            </div>
                        </div>

                        {recurrenceType === 'weekly' && (
                            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Select Days</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => {
                                                if (recurrenceDays.includes(idx)) {
                                                    setRecurrenceDays(recurrenceDays.filter(d => d !== idx));
                                                } else {
                                                    setRecurrenceDays([...recurrenceDays, idx]);
                                                }
                                            }}
                                            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${recurrenceDays.includes(idx) ? 'bg-green-500 text-white' : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="editTaskForm"
                        disabled={!title.trim()}
                        className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskEditModal;
