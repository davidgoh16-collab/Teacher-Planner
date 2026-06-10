import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Circle, Clock, Star, Plus, Sparkles, ExternalLink, Link as LinkIcon, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import ChatPanel, { ChatBag } from './ChatPanel';
import BriefingPanel from './BriefingPanel';
import AIInsightsPanel from './AIInsightsPanel';
import IconRenderer from './ui/IconRenderer';
import { Task, AppItem, AppTab } from '../types';

interface TodaysLesson { period: string; subject: string; hasPlan: boolean; title?: string; links?: string[]; }
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

const HomePage: React.FC<HomePageProps> = ({
  chat, todaysLessons, upcomingKeyDates, globalTasks, favouriteApps, onOpenApp, onNavigate, isReadOnly, onTasksRefresh, onToggleTask, onOpenTask, userName,
}) => {
  const todayISO = useMemo(() => new Date().toISOString().split('T')[0], []);
  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const headerDate = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  const [showOverdue, setShowOverdue] = useState(false);

  const { todaysTasks, overdueTasks, overdueCount } = useMemo(() => {
    const open = (t: Task) => t.status !== 'Completed';
    const todays = globalTasks.filter(t => open(t) && (t.scheduledDateStr === todayISO || t.deadlineDateStr === todayISO));
    const overdue = globalTasks
      .filter(t => open(t) && t.deadlineDateStr && t.deadlineDateStr < todayISO)
      .sort((a, b) => (a.deadlineDateStr || '').localeCompare(b.deadlineDateStr || ''));
    return { todaysTasks: todays, overdueTasks: overdue, overdueCount: overdue.length };
  }, [globalTasks, todayISO]);

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
        <Sparkles size={26} />
      </div>
      <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{greeting}{userName ? `, ${userName.split(' ')[0]}` : ''}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm">How can I help you plan today? Ask me to plan lessons, draft messages, or organise tasks.</p>
      <div className="flex flex-wrap gap-2 justify-center mt-5 max-w-md">
        {prompts.map((p, i) => (
          <button
            key={i}
            onClick={() => sendPrompt(p)}
            className="text-xs font-medium px-3 py-2 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Body: chat hero + Today rail */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
        <main className="flex-1 min-w-0 lg:h-full">
          <div className="h-[60vh] lg:h-full w-full">
            <ChatPanel layout="embedded" {...chat} emptyState={emptyState} />
          </div>
        </main>

        <aside className="lg:w-80 xl:w-96 shrink-0 lg:border-l border-gray-200 dark:border-slate-800 p-4 space-y-4 lg:h-full lg:overflow-y-auto">
          {/* Today's Lessons — full vertical list (no horizontal scrolling) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-sm"><BookOpen size={15} className="text-primary-600 dark:text-primary-400" /> Today's Lessons</h3>
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{headerDate}</span>
            </div>
            {todaysLessons.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">No lessons scheduled today.</p>
            ) : (
              <ul className="space-y-1.5">
                {todaysLessons.map((l, i) => {
                  const links = l.links || [];
                  const primaryLink = links[0];
                  // Show the class name (subject) as the main label, and the
                  // lesson plan title (the lesson they're on) as a sub-line.
                  const className = l.subject;
                  const lessonTitle = l.title && l.title !== l.subject ? l.title : undefined;
                  return (
                    <li key={i} className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800/60">
                      <div className="flex items-center gap-2.5">
                        {l.hasPlan
                          ? <CheckCircle2 size={15} className="text-primary-500 shrink-0" />
                          : <Circle size={15} className="text-slate-300 dark:text-slate-600 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          {primaryLink ? (
                            <a
                              href={normalizeUrl(primaryLink)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Open lesson link: ${className}`}
                              className="font-medium text-sm inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline max-w-full"
                            >
                              <span className="truncate">{className}</span>
                              <ExternalLink size={12} className="shrink-0" />
                            </a>
                          ) : (
                            <span className="font-medium text-sm truncate block">{className}</span>
                          )}
                          {lessonTitle && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">{lessonTitle}</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{l.period}</span>
                      </div>
                      {links.length > 1 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-[26px]">
                          {links.slice(1).map((link, li) => (
                            <a
                              key={li}
                              href={normalizeUrl(link)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              <LinkIcon size={10} className="shrink-0" />
                              <span className="truncate max-w-[140px]">Link {li + 2}</span>
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

          {/* Today's Tasks — vertical list */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-sm"><CheckCircle2 size={15} className="text-primary-600 dark:text-primary-400" /> Today's Tasks</h3>
              {overdueCount > 0 && (
                <button
                  onClick={() => setShowOverdue(v => !v)}
                  aria-expanded={showOverdue}
                  title={showOverdue ? 'Hide overdue tasks' : 'Show overdue tasks'}
                  className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors inline-flex items-center gap-1"
                >
                  {overdueCount} overdue
                  {showOverdue ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              )}
            </div>
            {todaysTasks.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Nothing due today.</p>
            ) : (
              <ul className="space-y-1.5">
                {todaysTasks.map(t => (
                  <li
                    key={t.id}
                    onClick={() => onOpenTask?.(t)}
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 ${onOpenTask ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors' : ''}`}
                  >
                    <button
                      onClick={(e) => onToggleTask?.(e, t)}
                      disabled={isReadOnly || !onToggleTask}
                      title={t.status === 'In Progress' ? 'In progress — click to complete' : 'Click to mark in progress'}
                      className={`mt-0.5 shrink-0 disabled:cursor-default ${t.status === 'In Progress' ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                    >
                      {t.status === 'In Progress' ? <Clock size={14} /> : <Circle size={14} />}
                    </button>
                    <span className={`text-sm flex-1 ${t.status === 'In Progress' ? 'text-amber-700 dark:text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>{t.title}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Overdue tasks — collapsible */}
            {overdueCount > 0 && showOverdue && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={12} /> Overdue ({overdueCount})
                </h4>
                <ul className="space-y-1.5">
                  {overdueTasks.map(t => (
                    <li
                      key={t.id}
                      onClick={() => onOpenTask?.(t)}
                      className={`flex items-start gap-2.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/15 ${onOpenTask ? 'cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/25 transition-colors' : ''}`}
                    >
                      <button
                        onClick={(e) => onToggleTask?.(e, t)}
                        disabled={isReadOnly || !onToggleTask}
                        title={t.status === 'In Progress' ? 'In progress — click to complete' : 'Click to mark in progress'}
                        className={`mt-0.5 shrink-0 disabled:cursor-default ${t.status === 'In Progress' ? 'text-amber-500' : 'text-red-300 dark:text-red-700 hover:text-red-500'}`}
                      >
                        {t.status === 'In Progress' ? <Clock size={14} /> : <Circle size={14} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm block ${t.status === 'In Progress' ? 'text-amber-700 dark:text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>{t.title}</span>
                        {t.deadlineDateStr && (
                          <span className="text-[11px] text-red-500 dark:text-red-400">Due {new Date(t.deadlineDateStr + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <BriefingPanel tasks={globalTasks} todaysLessons={todaysLessons} upcomingKeyDates={upcomingKeyDates} />
          <AIInsightsPanel contextType="all_tasks" tasks={globalTasks} isReadOnly={isReadOnly} onTaskUpdate={onTasksRefresh} />

          {/* Favourite apps */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-sm"><Star size={15} className="text-amber-500" /> Favourite Apps</h3>
              <button onClick={() => onNavigate('apps')} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Manage</button>
            </div>
            {favouriteApps.length === 0 ? (
              <button onClick={() => onNavigate('apps')} className="w-full text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2 py-5 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                <Plus size={20} /> Pin apps from the Apps page
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {favouriteApps.map(app => (
                  <button key={app.id} onClick={() => onOpenApp(app)} className="flex flex-col items-center gap-1.5 group" title={app.name}>
                    <IconRenderer app={app} size={20} className="w-11 h-11 group-hover:-translate-y-0.5 transition-transform" rounded="rounded-xl" />
                    <span className="text-[10px] text-slate-600 dark:text-slate-300 text-center truncate w-full">{app.name}</span>
                  </button>
                ))}
                <button onClick={() => onNavigate('apps')} className="flex flex-col items-center gap-1.5 group" title="Add app">
                  <div className="w-11 h-11 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center text-slate-400 group-hover:border-primary-400 group-hover:text-primary-500 transition-colors">
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
