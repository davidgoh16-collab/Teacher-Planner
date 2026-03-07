import React, { useState, useEffect } from 'react';
import { RoutineTask } from '../types';
import { fetchRoutineTasks, saveRoutineTask, deleteRoutineTask } from '../services/projectService';
import { Plus, CheckCircle2, Circle, Trash2, RotateCw } from 'lucide-react';

interface RoutineTasksViewProps {
    isReadOnly: boolean;
}

export default function RoutineTasksView({ isReadOnly }: RoutineTasksViewProps) {
    const [tasks, setTasks] = useState<RoutineTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');

    useEffect(() => {
        const load = async () => {
            const data = await fetchRoutineTasks() || [];
            setTasks(data.sort((a, b) => b.createdAt - a.createdAt));
            setLoading(false);
        };
        load();
    }, []);

    const getTodayStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const isCompletedToday = (task: RoutineTask) => {
        return task.lastCompletedDateStr === getTodayStr();
    };

    const handleToggleComplete = async (task: RoutineTask) => {
        if (isReadOnly) return;
        const today = getTodayStr();
        const updated = {
            ...task,
            lastCompletedDateStr: isCompletedToday(task) ? undefined : today
        };

        setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
        try {
            await saveRoutineTask(updated);
        } catch (e) {
            console.error("Failed to toggle routine task", e);
            setTasks(prev => prev.map(t => t.id === task.id ? task : t));
        }
    };

    const handleDelete = async (id: string) => {
        if (isReadOnly) return;
        if (!window.confirm("Delete this routine task?")) return;

        setTasks(prev => prev.filter(t => t.id !== id));
        try {
            await deleteRoutineTask(id);
        } catch (e) {
            console.error("Failed to delete routine task", e);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly || !newTaskTitle.trim()) return;

        const newTask: RoutineTask = {
            id: `routine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: newTaskTitle.trim(),
            priority: newTaskPriority,
            createdAt: Date.now()
        };

        setTasks(prev => [newTask, ...prev]);
        setNewTaskTitle('');
        setNewTaskPriority('Medium');

        try {
            await saveRoutineTask(newTask);
        } catch (e) {
            console.error("Failed to add routine task", e);
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'High': return 'text-red-600 border-red-200 bg-red-50 dark:bg-red-900/30 dark:border-red-800';
            case 'Medium': return 'text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800';
            case 'Low': return 'text-green-600 border-green-200 bg-green-50 dark:bg-green-900/30 dark:border-green-800';
            default: return 'text-slate-600 border-slate-200';
        }
    };

    if (loading) {
        return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div></div>;
    }

    return (
        <div className="flex flex-col flex-1 h-full min-h-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-green-50/50 dark:bg-green-900/10">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <RotateCw className="text-green-500" /> Routine Tasks
                </h2>
                <p className="text-sm text-slate-500 mt-1">Daily recurring tasks. Status resets every midnight.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-8">
                    {!isReadOnly && (
                        <form onSubmit={handleAdd} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                placeholder="E.g., Check emails, Plan tomorrow's lesson..."
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                required
                            />
                            <select
                                value={newTaskPriority}
                                onChange={(e) => setNewTaskPriority(e.target.value as any)}
                                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 w-full sm:w-auto"
                            >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                            <button type="submit" disabled={!newTaskTitle.trim()} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                <Plus size={16} /> Add
                            </button>
                        </form>
                    )}

                    {tasks.length === 0 ? (
                        <div className="text-center text-slate-400 dark:text-slate-500 py-10">
                            <RotateCw size={40} className="mx-auto mb-3 opacity-20" />
                            <p>No routine tasks yet.</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {tasks.map(task => {
                                const completed = isCompletedToday(task);
                                return (
                                    <li key={task.id} className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${completed ? 'bg-slate-50 border-slate-200 dark:bg-slate-800/30 dark:border-slate-800 opacity-60' : 'bg-white border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700'}`}>
                                        <div className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer" onClick={() => handleToggleComplete(task)}>
                                            <button className={`shrink-0 transition-transform ${isReadOnly ? '' : 'hover:scale-110'}`}>
                                                {completed ? <CheckCircle2 className="text-green-500" size={24} /> : <Circle className="text-slate-300 dark:text-slate-600" size={24} />}
                                            </button>
                                            <div className="flex flex-col">
                                                <span className={`font-semibold ${completed ? 'line-through text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                                                    {task.title}
                                                </span>
                                                <span className={`text-[10px] uppercase font-bold tracking-wider w-fit px-1.5 py-0.5 rounded border mt-1 ${getPriorityColor(task.priority)}`}>
                                                    {task.priority} Priority
                                                </span>
                                            </div>
                                        </div>
                                        {!isReadOnly && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                    <Trash2 size={18} />
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
    );
}
