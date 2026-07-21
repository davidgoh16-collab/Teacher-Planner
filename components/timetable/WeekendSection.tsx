import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import SectionLabel from '../ui/SectionLabel';
import { Task, RoutineTask, Project, Term, WeekData } from '../../types';
import { addDays, toISODate, formatDate } from '../../utils/dateUtils';
import { TaskRow, RoutineRow } from './TaskRows';

interface WeekendSectionProps {
  currentWeekData: WeekData | undefined;
  weeksInTerm: WeekData[];
  selectedWeekIndex: number;
  terms: Term[];
  selectedTermId: string;
  flatTasks: Task[];
  routineTasks: RoutineTask[];
  projects: Project[];
  globalTasks: Task[];
  isReadOnly: boolean;
  isRoutineCompleted: (task: RoutineTask, dateStr: string) => boolean;
  expandedActiveDays: Record<string, boolean>;
  expandedRoutineDays: Record<string, boolean>;
  setExpandedActiveDays: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setExpandedRoutineDays: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  toggleTaskCompletion: (e: React.MouseEvent, taskId: string, parentTaskId?: string) => void;
  handleToggleRoutineTask: (e: React.MouseEvent, task: RoutineTask, dateStr: string) => void;
  openCardModal: (task: Task) => void;
}

const WeekendSection: React.FC<WeekendSectionProps> = ({
  currentWeekData, weeksInTerm, selectedWeekIndex, terms, selectedTermId,
  flatTasks, routineTasks, projects, globalTasks, isReadOnly, isRoutineCompleted,
  expandedActiveDays, expandedRoutineDays, setExpandedActiveDays, setExpandedRoutineDays,
  toggleTaskCompletion, handleToggleRoutineTask, openCardModal,
}) => {
  if (!currentWeekData) return null;

  const saturdayDate = addDays(currentWeekData.startDate, 5);
  const sundayDate = addDays(currentWeekData.startDate, 6);
  const satDateStr = toISODate(saturdayDate);
  const sunDateStr = toISODate(sundayDate);

  // Holiday-backlog sweep: a gap > 3 days to the previous planner week (or the
  // previous term, for the first week) means a break — surface its tasks here.
  let holidayStartDateStr: string | null = null;
  let holidayEndDateStr: string | null = null;

  if (selectedWeekIndex > 0) {
    const prevWeekEnd = addDays(weeksInTerm[selectedWeekIndex - 1].startDate, 4);
    const daysDiff = Math.round((currentWeekData.startDate.getTime() - prevWeekEnd.getTime()) / (1000 * 3600 * 24));
    if (daysDiff > 3) {
      holidayStartDateStr = toISODate(addDays(prevWeekEnd, 1));
      holidayEndDateStr = toISODate(addDays(currentWeekData.startDate, -1));
    }
  } else if (selectedWeekIndex === 0) {
    const currentTermIdx = terms.findIndex(t => t.id === selectedTermId);
    if (currentTermIdx > 0) {
      const prevTerm = terms[currentTermIdx - 1];
      holidayStartDateStr = toISODate(addDays(prevTerm.endDate, 1));
      holidayEndDateStr = toISODate(addDays(currentWeekData.startDate, -1));
    }
  }

  const weekendTasks = flatTasks.filter(t => {
    const isWeekend =
      t.scheduledDateStr === satDateStr || t.deadlineDateStr === satDateStr ||
      t.scheduledDateStr === sunDateStr || t.deadlineDateStr === sunDateStr;
    let isHolidayBacklog = false;
    if (holidayStartDateStr && holidayEndDateStr) {
      if (t.scheduledDateStr && t.scheduledDateStr >= holidayStartDateStr && t.scheduledDateStr <= holidayEndDateStr) isHolidayBacklog = true;
      if (t.deadlineDateStr && t.deadlineDateStr >= holidayStartDateStr && t.deadlineDateStr <= holidayEndDateStr) isHolidayBacklog = true;
    }
    return isWeekend || isHolidayBacklog;
  });

  const hasHolidayBacklog = !!(holidayStartDateStr && holidayEndDateStr && weekendTasks.some(t =>
    (t.scheduledDateStr && t.scheduledDateStr >= holidayStartDateStr! && t.scheduledDateStr <= holidayEndDateStr!) ||
    (t.deadlineDateStr && t.deadlineDateStr >= holidayStartDateStr! && t.deadlineDateStr <= holidayEndDateStr!)
  ));

  const priorityWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
  weekendTasks.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

  const activeWeekendTasks = weekendTasks.filter(t => t.status !== 'Completed');
  const completedWeekendTasks = weekendTasks.filter(t => t.status === 'Completed');

  const withDay = (t: RoutineTask, targetDateStr: string, displayDay: string) => ({ ...t, targetDateStr, displayDay });
  const routinesSat = routineTasks.filter(t => t.daysOfWeek?.includes(6));
  const routinesSun = routineTasks.filter(t => t.daysOfWeek?.includes(0));
  const activeRoutines = [
    ...routinesSat.filter(t => !isRoutineCompleted(t, satDateStr)).map(t => withDay(t, satDateStr, 'Sat')),
    ...routinesSun.filter(t => !isRoutineCompleted(t, sunDateStr)).map(t => withDay(t, sunDateStr, 'Sun')),
  ];
  const completedRoutines = [
    ...routinesSat.filter(t => isRoutineCompleted(t, satDateStr)).map(t => withDay(t, satDateStr, 'Sat')),
    ...routinesSun.filter(t => isRoutineCompleted(t, sunDateStr)).map(t => withDay(t, sunDateStr, 'Sun')),
  ];

  const done = completedRoutines.length + completedWeekendTasks.length;
  const totalActive = activeRoutines.length + activeWeekendTasks.length;
  const total = done + totalActive;
  if (total === 0) return null;

  const pct = Math.round((done / total) * 100);
  const isExpandedActive = expandedActiveDays['weekend'] !== false;
  const isExpandedDone = !!expandedRoutineDays['weekend'];

  const dayFor = (t: Task) =>
    (t.scheduledDateStr === satDateStr || t.deadlineDateStr === satDateStr)
      ? ((t.scheduledDateStr === sunDateStr || t.deadlineDateStr === sunDateStr) ? 'Sat & Sun' : 'Sat')
      : (t.scheduledDateStr === sunDateStr || t.deadlineDateStr === sunDateStr) ? 'Sun'
      : 'Holiday backlog';

  return (
    <section className="mt-8 rounded-2xl border border-black/[0.06] bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-slate-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-lg text-slate-900 dark:text-white">
          {hasHolidayBacklog ? 'Weekend & holiday backlog' : 'Weekend'}
        </h3>
        <span className="text-xs tabular-nums text-slate-400">
          {formatDate(saturdayDate)} – {formatDate(sundayDate)} · {done} of {total} done
        </span>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1]">
        <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {totalActive > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpandedActiveDays(prev => ({ ...prev, weekend: !isExpandedActive }))}
            className="flex w-full items-center justify-between py-1"
          >
            <SectionLabel>To Do ({totalActive})</SectionLabel>
            {isExpandedActive ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          </button>
          {isExpandedActive && (
            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {activeRoutines.map(r => (
                <RoutineRow key={`r-${r.id}-${r.displayDay}`} routine={r} dateStr={r.targetDateStr!} isReadOnly={isReadOnly} handleToggleRoutineTask={handleToggleRoutineTask} />
              ))}
              {activeWeekendTasks.map(t => (
                <TaskRow key={t.id} task={t} projects={projects} globalTasks={globalTasks} isReadOnly={isReadOnly}
                  extraSub={`${dayFor(t)} · ${t.priority}`}
                  toggleTaskCompletion={toggleTaskCompletion} openCardModal={openCardModal} />
              ))}
            </div>
          )}
        </div>
      )}

      {done > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpandedRoutineDays(prev => ({ ...prev, weekend: !isExpandedDone }))}
            className="flex w-full items-center justify-between py-1"
          >
            <SectionLabel>Completed ({done})</SectionLabel>
            {isExpandedDone ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          </button>
          {isExpandedDone && (
            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {completedRoutines.map(r => (
                <RoutineRow key={`r-${r.id}-${r.displayDay}`} routine={r} dateStr={r.targetDateStr!} isReadOnly={isReadOnly} completed handleToggleRoutineTask={handleToggleRoutineTask} />
              ))}
              {completedWeekendTasks.map(t => (
                <TaskRow key={t.id} task={t} projects={projects} globalTasks={globalTasks} isReadOnly={isReadOnly} completed
                  extraSub={dayFor(t)}
                  toggleTaskCompletion={toggleTaskCompletion} openCardModal={openCardModal} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default WeekendSection;
