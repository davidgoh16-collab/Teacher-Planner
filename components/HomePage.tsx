import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Clock, Plus, Sparkles, ExternalLink, Link as LinkIcon, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import ChatPanel, { ChatBag } from './ChatPanel';
import BriefingPanel from './BriefingPanel';
import IconRenderer from './ui/IconRenderer';
import SectionLabel from './ui/SectionLabel';
import { Task, AppItem, AppTab } from '../types';
import { getTimetableDot } from '../utils/timetablePalette';

interface TodaysLesson { period: string; subject: string; hasPlan: boolean; title?: string; links?: string[]; colorClass?: string; }
interface UpcomingKeyDate { title: string; dateStr: string; }

interface HomePageProps {
  chat: ChatBag;
  todaysLessons: TodaysLesson[];
  upcomingKeyDates: UpcomingKeyDate[];
  globalTasks: Task[];
  favouriteApps: AppItem[];
  onOpenApp: (app: AppItem) => void;
  onNavigate: (tab: AppTab) => void;
  isReadOnly: boolean;
  onTasksRefresh?: () => void;
  onToggleTask?: (e: React.MouseEvent, task: Task) => void;
  onOpenTask?: (task: Task) => void;
  userName?: string;
}

const greetingFor = (h: number) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

// Ensure a user-entered link is treated as an absolute URL (e.g. "docs.google.com" -> "https://docs.google.com").
const normalizeUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

// Display-only compression of period labels for the rail ("Period 2" -> "P2").
const shortPeriod = (period: string) =>
  period.replace('Period ', 'P').replace('Morning Mtg', 'AM').replace('Afternoon Mtg', 'PM');

const HomePage: React.FC<HomePageProps> = ({
  chat, todaysLessons, upcomingKeyDates, globalTasks, favouriteApps, onOpenApp, onNavigate, isReadOnly, onTasksRefresh, onToggleTask, onOpenTask, userName,
}) => {
  const todayISO = useMemo(() => new Date().toISOString().split('T')[0], []);
  const now = new Date();
  const greeting = greetingFor(now.getHours());

  const [showOverdue, setShowOverdue] = useState(false);

  const { todaysTasks, overdueTasks, overdueCount } = useMemo(() => {
    const open = (t: Task) => t.status !== 'Completed';
    const todays = globalTasks.filter(t => open(t) && (t.scheduledDateStr === todayISO || t.deadlineDateStr === todayISO));
    const overdue = globalTasks
      .filter(t => open(t) && t.deadlineDateStr && t.deadlineDateStr < todayISO)
      .sort((a, b) => (a.deadlineDateStr || '').localeCompare(b.deadlineDateStr || ''));
    return { todaysTasks: todays, overdueTasks: overdue, overdueCount: overdue.length };
  }, [globalTasks, todayISO]);

  const unplannedCount = useMemo(() => todaysLessons.filter(l => !l.hasPlan).length, [todaysLessons]);

  // Data-aware suggested prompts.
  const prompts = useMemo(() => {
    const list: string[] = ['What should I focus on today?'];
    if (overdueCount > 0) list.push(`Help me tackle my ${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}`);
    const unplanned = todaysLessons.find(l => !l.hasPlan);
    if (unplanned) list.push(`Plan my ${unplanned.subject} lesson`);
    list.push('Summarise my week ahead');
    return list;
  }, [overdueCount, todaysLessons]);

  const sendPrompt = (text: string) => {
    chat.ensureConversation();
    chat.onSendMessage(text);
  };

  const emptyState = (
    <div className="flex flex-col items-center justify-center text-center px-4 py-8 my-auto">
      <div className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 p-3 rounded-2xl mb-4">
        <Sparkles size={22} />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">How can I help you plan today? Ask me to plan lessons, draft messages, or organise tasks.</p>
      <div className="flex flex-wrap gap-2 justify-center mt-5 max-w-md">
        {prompts.map((p, i) => (
          <button
            key={i}
            onClick={() => sendPrompt(p)}
            className="text-xs font-medium px-3 py-2 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Today hero band */}
      <div className="shrink-0 border-b border-black/[0.04] px-4 py-4 dark:border-white/[0.06] md:px-6">
        <SectionLabel>{greeting}{userName ? `, ${userName.split(' ')[0]}` : ''}</SectionLabel>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <h1 className="font-serif text-2xl text-slate-900 dark:text-white md:text-3xl">
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{todaysLessons.length}</span> lesson{todaysLessons.length === 1 ? '' : 's'}
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
            <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{todaysTasks.length}</span> task{todaysTasks.length === 1 ? '' : 's'}
            {unplannedCount > 0 && (
              <>
                <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                <span className="text-clay-600 dark:text-clay-300">{unplannedCount} unplanned</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Body: chat hero + Today rail */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
        <main className="flex-1 min-w-0 lg:h-full">
          <div className="h-[60vh] lg:h-full w-full">
            <ChatPanel layout="embedded" {...chat} emptyState={emptyState} />
          </div>
        </main>

        <aside className="lg:w-80 xl:w-96 shrink-0 lg:border-l border-black/[0.04] dark:border-white/[0.06] p-4 space-y-4 lg:h-full lg:overflow-y-auto">
          {/* Today's Lessons */}
          <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-slate-800">
            <div className="mb-1 flex items-center justify-between">
              <SectionLabel>Today's lessons</SectionLabel>
            </div>
            {todaysLessons.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No lessons scheduled today.</p>
            ) : (
              <ul className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                {todaysLessons.map((l, i) => {
                  const links = l.links || [];
                  const primaryLink = links[0];
                  const className = l.subject;
                  const lessonTitle = l.title && l.title !== l.subject ? l.title : undefined;
                  return (
                    <li key={i} className="flex flex-col gap-1 py-2">
                      <div className="flex items-center gap-3">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${getTimetableDot(l.colorClass)}`} />
                        <div className="min-w-0 flex-1">
                          {primaryLink ? (
                            <a
                              href={normalizeUrl(primaryLink)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Open lesson link: ${className}`}
                              className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300"
                            >
                              <span className="truncate">{className}</span>
                              <ExternalLink size={12} className="shrink-0" />
                            </a>
                          ) : (
                            <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{className}</span>
                          )}
                          {lessonTitle && (
                            <span className="block truncate text-xs text-slate-400 dark:text-slate-500">{lessonTitle}</span>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">{shortPeriod(l.period)}</span>
                        {l.hasPlan
                          ? <CheckCircle2 size={14} className="shrink-0 text-primary-500" />
                          : <Circle size={14} className="shrink-0 text-slate-300 dark:text-slate-600" />}
                      </div>
                      {links.length > 1 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-5">
                          {links.slice(1).map((link, li) => (
                            <a
                              key={li}
                              href={normalizeUrl(link)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline dark:text-primary-300"
                            >
                              <LinkIcon size={10} className="shrink-0" />
                              <span className="max-w-[140px] truncate">Link {li + 2}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Today's Tasks */}
          <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-slate-800">
            <div className="mb-1 flex items-center justify-between">
              <SectionLabel>Today's tasks</SectionLabel>
              {overdueCount > 0 && (
                <button
                  onClick={() => setShowOverdue(v => !v)}
                  aria-expanded={showOverdue}
                  title={showOverdue ? 'Hide overdue tasks' : 'Show overdue tasks'}
                  className="inline-flex items-center gap-1 rounded-full bg-terracotta-100 px-2 py-0.5 text-xs font-medium text-terracotta-700 transition-colors hover:bg-terracotta-200 dark:bg-terracotta-900/30 dark:text-terracotta-300 dark:hover:bg-terracotta-900/50"
                >
                  {overdueCount} overdue
                  {showOverdue ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              )}
            </div>
            {todaysTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Nothing due today.</p>
            ) : (
              <ul className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                {todaysTasks.map(t => (
                  <li
                    key={t.id}
                    onClick={() => onOpenTask?.(t)}
                    className={`flex items-start gap-3 py-2 ${onOpenTask ? 'cursor-pointer' : ''}`}
                  >
                    <button
                      onClick={(e) => onToggleTask?.(e, t)}
                      disabled={isReadOnly || !onToggleTask}
                      title={t.status === 'In Progress' ? 'In progress — click to complete' : 'Click to mark in progress'}
                      className={`mt-0.5 shrink-0 disabled:cursor-default ${t.status === 'In Progress' ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500 dark:text-slate-600'}`}
                    >
                      {t.status === 'In Progress' ? <Clock size={14} /> : <Circle size={14} />}
                    </button>
                    <span className={`flex-1 text-sm ${t.status === 'In Progress' ? 'text-amber-700 dark:text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>{t.title}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Overdue tasks — collapsible */}
            {overdueCount > 0 && showOverdue && (
              <div className="mt-2 border-t border-black/[0.04] pt-2 dark:border-white/[0.06]">
                <h4 className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-terracotta-600 dark:text-terracotta-300">
                  <AlertTriangle size={12} /> Overdue ({overdueCount})
                </h4>
                <ul className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                  {overdueTasks.map(t => (
                    <li
                      key={t.id}
                      onClick={() => onOpenTask?.(t)}
                      className={`flex items-start gap-3 py-2 ${onOpenTask ? 'cursor-pointer' : ''}`}
                    >
                      <button
                        onClick={(e) => onToggleTask?.(e, t)}
                        disabled={isReadOnly || !onToggleTask}
                        title={t.status === 'In Progress' ? 'In progress — click to complete' : 'Click to mark in progress'}
                        className={`mt-0.5 shrink-0 disabled:cursor-default ${t.status === 'In Progress' ? 'text-amber-500' : 'text-terracotta-300 hover:text-terracotta-500 dark:text-terracotta-700'}`}
                      >
                        {t.status === 'In Progress' ? <Clock size={14} /> : <Circle size={14} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <span className={`block text-sm ${t.status === 'In Progress' ? 'text-amber-700 dark:text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>{t.title}</span>
                        {t.deadlineDateStr && (
                          <span className="text-[11px] text-terracotta-600 dark:text-terracotta-300">Due {new Date(t.deadlineDateStr + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <BriefingPanel tasks={globalTasks} todaysLessons={todaysLessons} upcomingKeyDates={upcomingKeyDates} />

          {/* Favourite apps */}
          <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-slate-800">
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel>Favourite apps</SectionLabel>
              <button onClick={() => onNavigate('apps')} className="text-xs text-primary-700 hover:underline dark:text-primary-300">Manage</button>
            </div>
            {favouriteApps.length === 0 ? (
              <button onClick={() => onNavigate('apps')} className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-black/[0.1] py-5 text-sm text-slate-400 transition-colors hover:border-primary-400 hover:text-primary-600 dark:border-white/[0.12] dark:hover:text-primary-400">
                <Plus size={20} /> Pin apps from the Apps page
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {favouriteApps.map(app => (
                  <button key={app.id} onClick={() => onOpenApp(app)} className="group flex flex-col items-center gap-1.5" title={app.name}>
                    <IconRenderer app={app} size={20} className="h-11 w-11 transition-transform group-hover:-translate-y-0.5" rounded="rounded-xl" />
                    <span className="w-full truncate text-center text-[10px] text-slate-600 dark:text-slate-300">{app.name}</span>
                  </button>
                ))}
                <button onClick={() => onNavigate('apps')} className="group flex flex-col items-center gap-1.5" title="Add app">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-black/[0.1] text-slate-400 transition-colors group-hover:border-primary-400 group-hover:text-primary-500 dark:border-white/[0.12]">
                    <Plus size={18} />
                  </div>
                  <span className="text-[10px] text-slate-500">Add</span>
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default HomePage;
