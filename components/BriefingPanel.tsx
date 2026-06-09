import React, { useState, useEffect, useMemo } from 'react';
import { generateBriefing, Briefing, BriefingItem } from '../services/aiService';
import { Task } from '../types';
import { Sparkles, Loader2, ChevronUp, ChevronDown, RotateCcw, AlertTriangle, CalendarClock, BookOpen, Lightbulb } from 'lucide-react';

// Module-level cache so the briefing isn't regenerated on every remount within the same day.
const briefingCache: Record<string, Briefing> = {};
// Remember the collapsed state per-day so hiding/navigating away keeps it hidden
// WITHOUT throwing away the cached briefing (so re-showing is instant).
const collapsedDays: Set<string> = new Set();

interface TodaysLesson { period: string; subject: string; hasPlan: boolean; }
interface UpcomingKeyDate { title: string; dateStr: string; }

interface BriefingPanelProps {
    tasks: Task[];
    todaysLessons?: TodaysLesson[];
    upcomingKeyDates?: UpcomingKeyDate[];
}

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const iconFor = (kind: BriefingItem['kind']) => {
    switch (kind) {
        case 'overdue': return <AlertTriangle size={15} className="text-red-500" />;
        case 'due_today': return <CalendarClock size={15} className="text-amber-500" />;
        case 'lesson': return <BookOpen size={15} className="text-blue-500" />;
        default: return <Lightbulb size={15} className="text-green-500" />;
    }
};

export default function BriefingPanel({ tasks, todaysLessons = [], upcomingKeyDates = [] }: BriefingPanelProps) {
    const todayISO = useMemo(() => new Date().toISOString().split('T')[0], []);
    const [briefing, setBriefing] = useState<Briefing | null>(briefingCache[todayISO] || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(collapsedDays.has(todayISO));

    // Derive overdue / due-today from the task list (open tasks only).
    const { overdueTasks, dueTodayTasks } = useMemo(() => {
        const overdue: { id: string; title: string; deadlineDateStr?: string }[] = [];
        const dueToday: { id: string; title: string }[] = [];
        const isOpen = (t: Task) => t.status !== 'Completed';
        tasks.forEach(t => {
            if (!isOpen(t)) return;
            const due = t.deadlineDateStr;
            if (due) {
                if (due < todayISO) overdue.push({ id: t.id, title: t.title, deadlineDateStr: due });
                else if (due === todayISO) dueToday.push({ id: t.id, title: t.title });
            } else if (t.scheduledDateStr === todayISO) {
                dueToday.push({ id: t.id, title: t.title });
            }
        });
        return { overdueTasks: overdue, dueTodayTasks: dueToday };
    }, [tasks, todayISO]);

    const loadBriefing = async (force = false) => {
        if (isLoading) return;
        if (!force && briefingCache[todayISO]) {
            setBriefing(briefingCache[todayISO]);
            return;
        }
        setIsLoading(true);
        try {
            const result = await generateBriefing({
                todayISO,
                weekday: weekdayNames[new Date().getDay()],
                overdueTasks,
                dueTodayTasks,
                todaysLessons,
                upcomingKeyDates,
            });
            briefingCache[todayISO] = result;
            setBriefing(result);
        } catch (e) {
            console.error('Failed to load briefing', e);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-fetch once per day on mount (proactive — no button press needed).
    useEffect(() => {
        if (briefingCache[todayISO]) {
            setBriefing(briefingCache[todayISO]);
            return;
        }
        // Only auto-generate when there's something to summarise.
        if (tasks.length === 0 && todaysLessons.length === 0 && upcomingKeyDates.length === 0) return;
        loadBriefing();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [todayISO]);

    const toggleCollapsed = () => {
        setIsCollapsed(prev => {
            const next = !prev;
            if (next) collapsedDays.add(todayISO); else collapsedDays.delete(todayISO);
            return next;
        });
    };

    // Nothing generated yet and nothing loading — stay out of the way.
    if (!briefing && !isLoading) return null;

    const hasContent = briefing && (briefing.summary || briefing.items.length > 0);

    return (
        <div className={`bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl ${isCollapsed ? 'p-4' : 'p-5'} shadow-sm animate-in fade-in slide-in-from-top-4 relative overflow-hidden`}>
            <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-400/10 dark:bg-emerald-500/10 blur-3xl -translate-y-1/2 translate-x-1/3 rounded-full pointer-events-none" />

            <div className={`flex justify-between items-center ${isCollapsed ? '' : 'mb-3'} relative z-10`}>
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-bold">
                    <div className="bg-emerald-100 dark:bg-emerald-900/50 p-1.5 rounded-lg shadow-sm">
                        <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    Your Briefing
                </div>
                <div className="flex gap-2">
                    {!isCollapsed && (
                        <button onClick={() => loadBriefing(true)} disabled={isLoading} className="text-emerald-600/60 hover:text-emerald-800 dark:text-emerald-400/60 dark:hover:text-emerald-300 transition-colors p-1" title="Refresh briefing">
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                        </button>
                    )}
                    <button onClick={toggleCollapsed} className="text-emerald-600/60 hover:text-emerald-800 dark:text-emerald-400/60 dark:hover:text-emerald-300 transition-colors p-1" title={isCollapsed ? 'Show briefing' : 'Hide briefing'}>
                        {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                isLoading && !briefing ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 relative z-10">
                        <Loader2 size={16} className="animate-spin" /> Putting together your day...
                    </div>
                ) : hasContent ? (
                    <div className="relative z-10">
                        {briefing!.greeting && <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{briefing!.greeting}</p>}
                        {briefing!.summary && <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{briefing!.summary}</p>}
                        {briefing!.items.length > 0 && (
                            <ul className="mt-3 space-y-1.5">
                                {briefing!.items.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 rounded-lg px-3 py-2 border border-emerald-100 dark:border-emerald-900/30">
                                        <span className="mt-0.5 shrink-0">{iconFor(item.kind)}</span>
                                        <div className="min-w-0">
                                            <p className="text-sm text-slate-800 dark:text-slate-100 leading-tight">{item.title}</p>
                                            {item.detail && <p className="text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300 relative z-10">You're all caught up — nothing urgent right now.</p>
                )
            )}
        </div>
    );
}
