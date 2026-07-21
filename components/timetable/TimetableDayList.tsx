import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WeeklyTimetable, LessonPlan, WeekData } from '../../types';
import { PERIOD_LABELS, DAYS } from '../../constants';
import { addDays, toISODate, formatDate, getLessonKey } from '../../utils/dateUtils';
import { getTimetableDot } from '../../utils/timetablePalette';
import { SHORT_LABEL, COMPACT_PERIODS, splitSubject } from './shared';
import { DayTaskBuckets } from './useDayTasks';

interface TimetableDayListProps {
  currentWeekData: WeekData;
  timetable: WeeklyTimetable;
  lessonPlans: Record<string, LessonPlan>;
  viewFilter: string;
  isReadOnly: boolean;
  mobileDayIndex: number;
  setMobileDayIndex: (i: number) => void;
  buckets: DayTaskBuckets | undefined;
  onOpenDayTasks: (dateStr: string, dayLabel: string) => void;
  openLessonModal: (dateStr: string, periodLabel: string, subjectName: string) => void;
  toggleCompletion: (e: React.MouseEvent, dateStr: string, periodLabel: string) => void;
  onJumpToToday: () => void;
  todayInWeekIndex: number | null; // 0-4 when today falls inside the current week
}

const TimetableDayList: React.FC<TimetableDayListProps> = ({
  currentWeekData, timetable, lessonPlans, viewFilter, isReadOnly,
  mobileDayIndex, setMobileDayIndex, buckets, onOpenDayTasks,
  openLessonModal, toggleCompletion, onJumpToToday, todayInWeekIndex,
}) => {
  const day = DAYS[mobileDayIndex];
  const rowDate = addDays(currentWeekData.startDate, mobileDayIndex);
  const dateStr = toISODate(rowDate);
  const isTodayShown = todayInWeekIndex === mobileDayIndex;
  const daySchedule = timetable[day] || {};

  return (
    <div className="px-4 pb-6">
      {/* Day stepper */}
      <div className="sticky top-0 z-10 -mx-4 bg-[#faf7f2]/95 px-4 py-2 backdrop-blur-sm dark:bg-[#1c1a17]/95">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMobileDayIndex(mobileDayIndex - 1)}
            disabled={mobileDayIndex === 0}
            aria-label="Previous day"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.06] bg-white text-slate-500 disabled:opacity-30 dark:border-white/[0.08] dark:bg-slate-800 dark:text-slate-300"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="font-serif text-lg text-slate-900 dark:text-white">{isTodayShown ? 'Today' : day}</p>
            <p className="text-xs text-slate-400">{formatDate(rowDate)} · Week {currentWeekData.weekNumber}</p>
          </div>
          <button
            onClick={() => setMobileDayIndex(mobileDayIndex + 1)}
            disabled={mobileDayIndex === DAYS.length - 1}
            aria-label="Next day"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.06] bg-white text-slate-500 disabled:opacity-30 dark:border-white/[0.08] dark:bg-slate-800 dark:text-slate-300"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {!isTodayShown && (
          <button
            onClick={onJumpToToday}
            className="mx-auto mt-1.5 block rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
          >
            Jump to today
          </button>
        )}
      </div>

      {/* Tasks summary */}
      <button
        onClick={() => onOpenDayTasks(dateStr, day)}
        className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-slate-800"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${buckets && buckets.total > 0 && buckets.done === buckets.total ? 'bg-primary-500' : 'bg-clay-400'}`} />
        <span className="flex-1 text-left text-sm text-slate-700 dark:text-slate-200">
          Tasks
          <span className="text-slate-400"> · {!buckets || buckets.total === 0 ? 'none' : `${buckets.total - buckets.done} to do · ${buckets.done} done`}</span>
        </span>
        {buckets && buckets.total > 0 && (
          <span className="h-1 w-16 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1]">
            <span className="block h-full rounded-full bg-primary-500" style={{ width: `${buckets.pct}%` }} />
          </span>
        )}
        <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
      </button>

      {/* Period list */}
      <div className="mt-3 divide-y divide-black/[0.04] rounded-2xl border border-black/[0.06] bg-white dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-slate-800">
        {PERIOD_LABELS.map((period) => {
          const entry = daySchedule[period] || null;
          const plan = lessonPlans[getLessonKey(dateStr, period)];
          const hasPlan = plan && (plan.title || plan.links?.length || plan.notes);
          const isCompactEmpty = COMPACT_PERIODS.has(period) && !entry && !hasPlan;
          const filtered = viewFilter !== 'All' && entry != null && entry.subject !== viewFilter;
          const { main, room } = entry ? splitSubject(entry) : { main: '', room: null };

          return (
            <button
              key={period}
              onClick={() => openLessonModal(dateStr, period, entry ? entry.subject : 'Free Period')}
              className={`flex w-full items-center gap-3 px-4 text-left ${isCompactEmpty ? 'py-1.5' : 'py-3'} ${filtered ? 'opacity-30' : ''}`}
            >
              <span className="w-12 shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">{SHORT_LABEL[period] || period}</span>
              <span className={`h-2 w-2 shrink-0 rounded-full ${entry ? getTimetableDot(entry.colorClass) : 'border border-black/[0.08] bg-transparent dark:border-white/[0.1]'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-medium ${entry ? 'text-slate-800 dark:text-slate-100' : 'text-slate-300 dark:text-slate-600'}`}>
                  {entry ? main : hasPlan ? plan!.title || 'Planned' : 'Free'}
                </span>
                {entry && (
                  <span className="block truncate text-xs text-slate-400">
                    {[room, hasPlan ? plan!.title : null].filter(Boolean).join(' · ') || 'No plan'}
                  </span>
                )}
              </span>
              {hasPlan && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); if (!isReadOnly) toggleCompletion(e as any, dateStr, period); }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-500 dark:text-slate-300"
                  title={plan!.completed ? 'Planned · complete' : 'Planned'}
                >
                  <span className={plan!.completed
                    ? 'h-2 w-2 rounded-full bg-current opacity-70'
                    : 'h-2 w-2 rounded-full border-[1.5px] border-current opacity-60'} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TimetableDayList;
