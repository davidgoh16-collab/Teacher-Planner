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
    const [newTaskType, setNewTaskType] = useState<'daily' | 'weekly'>('daily');
    const [newTaskDays, setNewTaskDays] = useState<number[]>([]);

    useEffect(() => {
        const load = async () => {
            const data = await fetchRoutineTasks() || [];
            setTasks(data);
            setLoading(false);
        };
        load();
    }, []);

    const getTodayStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const isCompleted = (task: RoutineTask) => {
        const todayStr = getTodayStr();
        if (task.type === 'daily' || !task.type) {
             return task.lastCompletedDateStr === todayStr;
        } else {
             // For weekly, check if it's been completed since the LAST time this day occurred.
             // A simpler robust way: if it's completed on OR after the most recent occurrence of its scheduled days.
             // But actually, the prompt says "remains checked until the next scheduled day occurs".
             // Let's implement this: it resets when today is a scheduled day, BUT only if it wasn't already completed today.
             // Wait, a better logic:
             // If today is a scheduled day, and it wasn't completed today, it's unchecked.
             // If it was completed today, it's checked.
             // What if today is NOT a scheduled day? It should remain checked if it was completed on the last scheduled day.
             // Since we only really care about it being checked or unchecked based on user action,
             // and we just reset it when the day arrives, maybe it's easier to just check if `lastCompletedDateStr` is >= the date of the most recent scheduled day.

             if (!task.lastCompletedDateStr) return false;

             const today = new Date();
             today.setHours(0,0,0,0);

             // Find the most recent scheduled date
             if (!task.daysOfWeek || task.daysOfWeek.length === 0) return task.lastCompletedDateStr === todayStr;

             let mostRecentScheduledDate = new Date(today);
             let found = false;

             for (let i = 0; i < 7; i++) {
                 const testDate = new Date(today);
                 testDate.setDate(today.getDate() - i);
                 if (task.daysOfWeek.includes(testDate.getDay())) {
                     mostRecentScheduledDate = testDate;
                     found = true;
                     break;
                 }
             }

             if (!found) return false;

             const [year, month, day] = task.lastCompletedDateStr.split('-').map(Number);
             const lastCompletedDate = new Date(year, month - 1, day);
             lastCompletedDate.setHours(0,0,0,0);

             return lastCompletedDate >= mostRecentScheduledDate;
        }
    };

    const handleToggleComplete = async (task: RoutineTask) => {
        if (isReadOnly) return;
        const today = getTodayStr();
        const currentlyCompleted = isCompleted(task);
        const updated = {
            ...task,
            lastCompletedDateStr: currentlyCompleted ? undefined : today
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
            type: newTaskType,
            daysOfWeek: newTaskType === 'weekly' ? newTaskDays : undefined,
            createdAt: Date.now()
        };

        setTasks(prev => [newTask, ...prev]);
        setNewTaskTitle('');
        setNewTaskPriority('Medium');
        setNewTaskType('daily');
        setNewTaskDays([]);

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
            case 'Low': return 'text-primary-600 border-primary-200 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-800';
            default: return 'text-slate-600 border-slate-200';
        }
    };

    if (loading) {
        return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
    }

    return (
        <div className="flex flex-col flex-1 h-full min-h-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-primary-50/50 dark:bg-primary-900/10">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <RotateCw className="text-primary-500" /> Routine Tasks
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
                                className="flex-1 bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                required
                            />
                            <select
                                value={newTaskPriority}
                                onChange={(e) => setNewTaskPriority(e.target.value as any)}
                                className="bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 w-full sm:w-auto"
                            >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                            <select
                                value={newTaskType}
                                onChange={(e) => {
                                    setNewTaskType(e.target.value as 'daily' | 'weekly');
                                    if (e.target.value === 'daily') setNewTaskDays([]);
                                }}
                                className="bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 w-full sm:w-auto"
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>

                            <button type="submit" disabled={!newTaskTitle.trim() || (newTaskType === 'weekly' && newTaskDays.length === 0)} className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                <Plus size={16} /> Add
                            </button>
                        </form>
                    )}

                    {!isReadOnly && newTaskType === 'weekly' && (
                        <div className="flex gap-2 mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 self-center mr-2">Select Days:</span>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => {
                                        if (newTaskDays.includes(idx)) {
                                            setNewTaskDays(newTaskDays.filter(d => d !== idx));
                                        } else {
                                            setNewTaskDays([...newTaskDays, idx]);
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${newTaskDays.includes(idx) ? 'bg-primary-500 text-white' : 'bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    )}

                    {tasks.length === 0 ? (
                        <div className="text-center text-slate-400 dark:text-slate-500 py-10">
                            <RotateCw size={40} className="mx-auto mb-3 opacity-20" />
                            <p>No routine tasks yet.</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {(() => {
                                // Calculate days until next occurrence for each task
                                const todayDay = new Date().getDay();

                                const getDaysUntil = (task: RoutineTask) => {
                                    if (task.type === 'daily' || !task.type || !task.daysOfWeek || task.daysOfWeek.length === 0) return 0;

                                    // Find the next scheduled day
                                    let minDays = 7;
                                    for (const day of task.daysOfWeek) {
                                        let diff = day - todayDay;
                                        if (diff < 0) diff += 7;
                                        if (diff < minDays) minDays = diff;
                                    }
                                    return minDays;
                                };

                                const sortedTasks = [...tasks].sort((a, b) => {
                                    const aDays = getDaysUntil(a);
                                    const bDays = getDaysUntil(b);
                                    if (aDays !== bDays) return aDays - bDays;
                                    return b.createdAt - a.createdAt; // fallback to created at
                                });

                                const getDayNames = (days: number[]) => {
                                     const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                     return days.map(d => names[d]).join(', ');
                                };

                                return sortedTasks.map(task => {
                                    const completed = isCompleted(task);
                                    const daysUntil = getDaysUntil(task);
                                    const isDueToday = daysUntil === 0;

                                    return (
                                        <li key={task.id} className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${completed ? 'bg-slate-50 border-slate-200 dark:bg-slate-800/30 dark:border-slate-800 opacity-60' : (isDueToday ? 'bg-white border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700' : 'bg-slate-50/50 border-slate-200/50 dark:bg-slate-800/20 dark:border-slate-700/50 opacity-80')}`}>
                                            <div className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer" onClick={() => handleToggleComplete(task)}>
                                                <button onClick={(e) => { e.stopPropagation(); handleToggleComplete(task); }} className={`shrink-0 transition-transform ${isReadOnly ? '' : 'hover:scale-110'}`}>
                                                    {completed ? <CheckCircle2 className="text-primary-500" size={24} /> : <Circle className="text-slate-300 dark:text-slate-600" size={24} />}
                                                </button>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-semibold ${completed ? 'line-through text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                                                            {task.title}
                                                        </span>
                                                        {task.type === 'weekly' && task.daysOfWeek && task.daysOfWeek.length > 0 && (
                                                            <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                                                                {getDayNames(task.daysOfWeek)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[10px] uppercase font-bold tracking-wider w-fit px-1.5 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                                                            {task.priority} Priority
                                                        </span>
                                                        {!isDueToday && (
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                                                                Upcoming in {daysUntil} {daysUntil === 1 ? 'day' : 'days'}
                                                            </span>
                                                        )}
                                                    </div>
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
                                });
                            })()}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
