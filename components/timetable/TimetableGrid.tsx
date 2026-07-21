import React from 'react';
import { WeeklyTimetable, LessonPlan, WeekData } from '../../types';
import { PERIOD_LABELS, DAYS } from '../../constants';
import { addDays, toISODate, formatDate, getLessonKey } from '../../utils/dateUtils';
import { getEntryClassName } from '../../utils/colorUtils';
import { SHORT_LABEL, COMPACT_PERIODS, splitSubject } from './shared';
import { DayTaskBuckets } from './useDayTasks';

interface TimetableGridProps {
  currentWeekData: WeekData;
  timetable: WeeklyTimetable;
  lessonPlans: Record<string, LessonPlan>;
  viewFilter: string;
  isReadOnly: boolean;
  dayBuckets: Record<string, DayTaskBuckets>; // keyed by dateStr
  onOpenDayTasks: (dateStr: string, dayLabel: string) => void;
  openLessonModal: (dateStr: string, periodLabel: string, subjectName: string) => void;
  toggleCompletion: (e: React.MouseEvent, dateStr: string, periodLabel: string) => void;
}

const GRID_COLS = 'grid grid-cols-[52px_repeat(5,minmax(0,1fr))] gap-x-2';

const TimetableGrid: React.FC<TimetableGridProps> = ({
  currentWeekData, timetable, lessonPlans, viewFilter, isReadOnly,
  dayBuckets, onOpenDayTasks, openLessonModal, toggleCompletion,
}) => {
  const todayStr = toISODate(new Date());
  const dayInfo = DAYS.map((day, i) => {
    const rowDate = addDays(currentWeekData.startDate, i);
    const dateStr = toISODate(rowDate);
    return { day, rowDate, dateStr, isToday: dateStr === todayStr };
  });

  const planDot = (dateStr: string, period: string) => {
    const plan = lessonPlans[getLessonKey(dateStr, period)];
    const hasPlan = plan && (plan.title || plan.links?.length || plan.notes);
    if (!hasPlan) return null;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); if (!isReadOnly) toggleCompletion(e, dateStr, period); }}
        title={plan.completed ? 'Planned · complete — click to un-complete' : 'Planned — click to mark complete'}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center"
      >
        <span className={plan.completed
          ? 'h-2 w-2 rounded-full bg-current opacity-70'
          : 'h-2 w-2 rounded-full border-[1.5px] border-current opacity-60'} />
      </button>
    );
  };

  return (
    <div>
      {/* Sticky day-header row */}
      <div className="sticky top-0 z-10 -mx-1 bg-[#faf7f2]/95 px-1 pb-2 backdrop-blur-sm dark:bg-[#1c1a17]/95">
        <div className={GRID_COLS}>
          <div />
          {dayInfo.map(({ day, rowDate, dateStr, isToday }) => {
            const b = dayBuckets[dateStr];
            return (
              <button
                key={day}
                onClick={() => onOpenDayTasks(dateStr, day)}
                title={`${day} tasks`}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${
                  isToday ? 'ring-1 ring-primary-400/60 bg-primary-50/60 dark:bg-primary-900/20' : ''
                }`}
              >
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{day.slice(0, 3)}</span>
                <span className={`font-serif text-lg leading-tight ${isToday ? 'text-primary-700 dark:text-primary-300' : 'text-slate-800 dark:text-white'}`}>
                  {formatDate(rowDate)}
                </span>
                {b && b.total > 0 ? (
                  <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] tabular-nums text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${b.done === b.total ? 'bg-primary-500' : 'bg-clay-400'}`} />
                    {b.total} · {b.done} done
                  </span>
                ) : (
                  <span className="mt-1 h-[18px]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body: period rows × day columns */}
      <div className={`${GRID_COLS} gap-y-1.5`}>
        {PERIOD_LABELS.map((period) => {
          const isCompact = COMPACT_PERIODS.has(period);
          return (
            <React.Fragment key={period}>
              <div className={`flex items-center justify-end pr-1 ${isCompact ? 'py-0.5' : ''}`}>
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{SHORT_LABEL[period] || period}</span>
              </div>
              {dayInfo.map(({ day, dateStr, isToday }) => {
                const entry = (timetable[day] || {})[period] || null;
                const plan = lessonPlans[getLessonKey(dateStr, period)];
                const hasPlan = plan && (plan.title || plan.links?.length || plan.notes);
                const isMeeting = plan?.type === 'meeting';
                const filtered = viewFilter !== 'All' && entry?.subject !== viewFilter;

                if (!entry && !hasPlan) {
                  // Free cell — nearly invisible, hover reveals the action
                  return (
                    <div
                      key={day}
                      onClick={() => openLessonModal(dateStr, period, 'Free Period')}
                      className={`group/cell relative flex cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${
                        isCompact ? 'min-h-[30px] bg-black/[0.02] dark:bg-white/[0.03]' : 'min-h-[76px]'
                      } ${isToday ? 'ring-1 ring-primary-300/40' : ''}`}
                    >
                      <span className="text-[10px] font-medium text-slate-400 opacity-0 transition-opacity group-hover/cell:opacity-100">
                        {isReadOnly ? 'View' : '+ Plan'}
                      </span>
                    </div>
                  );
                }

                if (!entry && hasPlan) {
                  // Planned free period — quiet slate chip
                  return (
                    <div
                      key={day}
                      onClick={() => openLessonModal(dateStr, period, 'Free Period')}
                      className={`relative flex cursor-pointer flex-col rounded-lg border border-black/[0.06] bg-slate-50 px-2.5 py-2 text-slate-600 transition-all hover:shadow-sm dark:border-white/[0.08] dark:bg-slate-800/60 dark:text-slate-300 ${
                        isCompact ? 'min-h-[30px] justify-center py-1' : 'min-h-[76px]'
                      } ${isToday ? 'ring-1 ring-primary-300/50' : ''} ${isMeeting ? 'ring-1 ring-heather-400/40' : ''} ${filtered ? 'opacity-30' : ''}`}
                    >
                      <p className="truncate text-[11px] font-medium leading-tight">{plan!.title || 'Planned'}</p>
                      {planDot(dateStr, period)}
                    </div>
                  );
                }

                const { main, room } = splitSubject(entry!);

                if (isCompact) {
                  return (
                    <div
                      key={day}
                      onClick={() => openLessonModal(dateStr, period, entry!.subject)}
                      className={`relative flex min-h-[30px] cursor-pointer flex-row items-center gap-2 rounded-md border px-2.5 py-1 transition-all hover:shadow-sm ${getEntryClassName(entry)} ${
                        isToday ? 'ring-1 ring-primary-300/50' : ''
                      } ${isMeeting ? 'ring-1 ring-heather-400/40' : ''} ${filtered ? 'opacity-30' : ''}`}
                    >
                      <p className="truncate text-[11px] font-medium leading-tight">{main}</p>
                      {planDot(dateStr, period)}
                    </div>
                  );
                }

                return (
                  <div
                    key={day}
                    onClick={() => openLessonModal(dateStr, period, entry!.subject)}
                    className={`relative flex min-h-[76px] cursor-pointer flex-col rounded-lg border px-2.5 py-2 transition-all hover:shadow-sm ${getEntryClassName(entry)} ${
                      isToday ? 'ring-1 ring-primary-300/50' : ''
                    } ${isMeeting ? 'ring-1 ring-heather-400/40' : ''} ${filtered ? 'opacity-30' : ''}`}
                  >
                    <p className="truncate pr-4 text-[13px] font-semibold leading-tight">{main}</p>
                    {room && <p className="truncate text-[11px] leading-tight opacity-70">{room}</p>}
                    {hasPlan && (
                      <p className={`mt-auto line-clamp-2 pt-1 text-[11px] leading-snug opacity-80 ${plan!.completed ? 'line-through opacity-50' : ''}`}>
                        {plan!.title || 'Planned'}
                      </p>
                    )}
                    {planDot(dateStr, period)}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default TimetableGrid;
