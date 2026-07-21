import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { WeeklyTimetable, LessonPlan, Task, RoutineTask, Project, Term, WeekData } from '../../types';
import { DAYS } from '../../constants';
import { addDays, toISODate, formatDate } from '../../utils/dateUtils';
import PageHeading from '../ui/PageHeading';
import TimetableGrid from './TimetableGrid';
import TimetableDayList from './TimetableDayList';
import DayTasksSheet from './DayTasksSheet';
import WeekendSection from './WeekendSection';
import { useFlatTasks, getDayTaskBuckets, DayTaskBuckets } from './useDayTasks';

interface TimetableViewProps {
  needsSetup: boolean;
  isDataLoading: boolean;
  onStartSetup: () => void;
  onOpenSettings: () => void;
  currentWeekData: WeekData | undefined;
  timetableWeek1: WeeklyTimetable;
  timetableWeek2: WeeklyTimetable;
  lessonPlans: Record<string, LessonPlan>;
  globalTasks: Task[];
  projects: Project[];
  routineTasks: RoutineTask[];
  weeksInTerm: WeekData[];
  selectedWeekIndex: number;
  terms: Term[];
  selectedTermId: string;
  viewFilter: string;
  isReadOnly: boolean;
  expandedActiveDays: Record<string, boolean>;
  expandedRoutineDays: Record<string, boolean>;
  setExpandedActiveDays: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setExpandedRoutineDays: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  openLessonModal: (dateStr: string, periodLabel: string, subjectName: string) => void;
  toggleCompletion: (e: React.MouseEvent, dateStr: string, periodLabel: string) => void;
  toggleTaskCompletion: (e: React.MouseEvent, taskId: string, parentTaskId?: string) => void;
  isRoutineCompleted: (task: RoutineTask, dateStr: string) => boolean;
  handleToggleRoutineTask: (e: React.MouseEvent, task: RoutineTask, dateStr: string) => void;
  openCardModal: (task: Task) => void;
  onJumpToCurrentWeek: () => void;
}

const TimetableView: React.FC<TimetableViewProps> = (props) => {
  const {
    needsSetup, isDataLoading, onStartSetup, onOpenSettings,
    currentWeekData, timetableWeek1, timetableWeek2, lessonPlans,
    globalTasks, projects, routineTasks,
    weeksInTerm, selectedWeekIndex, terms, selectedTermId,
    viewFilter, isReadOnly,
    expandedActiveDays, expandedRoutineDays, setExpandedActiveDays, setExpandedRoutineDays,
    openLessonModal, toggleCompletion, toggleTaskCompletion,
    isRoutineCompleted, handleToggleRoutineTask, openCardModal, onJumpToCurrentWeek,
  } = props;

  const flatTasks = useFlatTasks(globalTasks);

  // Which weekday (0-4) is today, if today falls inside the displayed week.
  const todayInWeekIndex = useMemo(() => {
    if (!currentWeekData) return null;
    const todayStr = toISODate(new Date());
    for (let i = 0; i < DAYS.length; i++) {
      if (toISODate(addDays(currentWeekData.startDate, i)) === todayStr) return i;
    }
    return null;
  }, [currentWeekData]);

  const [mobileDayIndex, setMobileDayIndex] = useState(() => todayInWeekIndex ?? 0);
  useEffect(() => {
    // Reset to today (or Monday) when the displayed week changes.
    setMobileDayIndex(todayInWeekIndex ?? 0);
  }, [currentWeekData?.startDate?.getTime()]);

  const [sheetDateStr, setSheetDateStr] = useState<string | null>(null);
  const [sheetDayLabel, setSheetDayLabel] = useState('');

  // Task buckets per day of the displayed week (header chips + sheet + mobile summary).
  const dayBuckets = useMemo(() => {
    const map: Record<string, DayTaskBuckets> = {};
    if (!currentWeekData) return map;
    DAYS.forEach((_, i) => {
      const d = addDays(currentWeekData.startDate, i);
      const dateStr = toISODate(d);
      map[dateStr] = getDayTaskBuckets(flatTasks, routineTasks, dateStr, d.getDay(), isRoutineCompleted);
    });
    return map;
  }, [currentWeekData, flatTasks, routineTasks, isRoutineCompleted]);

  if (needsSetup) {
    return (
      <div className="mx-auto max-w-xl p-4 md:p-8">
        <div className="mt-6 rounded-2xl border border-black/[0.06] bg-white p-8 text-center dark:border-white/[0.08] dark:bg-slate-800">
          <CalendarDays size={28} className="mx-auto mb-4 text-primary-600 dark:text-primary-400" />
          <h2 className="font-serif text-xl text-slate-900 dark:text-white">Let's set up your planner</h2>
          <p className="mx-auto mt-1 mb-6 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Add your academic year, term dates and timetable to get started.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={onStartSetup} className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700">
              Start setup
            </button>
            <button onClick={onOpenSettings} className="rounded-xl border border-black/[0.06] bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
              Open Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isDataLoading && Object.keys(lessonPlans).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
        <p>Loading your planner...</p>
      </div>
    );
  }

  if (!currentWeekData) return null;

  const timetable = currentWeekData.weekNumber === 1 ? timetableWeek1 : timetableWeek2;

  const openDayTasks = (dateStr: string, dayLabel: string) => {
    setSheetDateStr(dateStr);
    setSheetDayLabel(dayLabel);
  };

  const jumpToToday = () => {
    if (todayInWeekIndex != null) {
      setMobileDayIndex(todayInWeekIndex);
    } else {
      onJumpToCurrentWeek();
    }
  };

  const sheetSubtitle = sheetDateStr
    ? `${formatDate(new Date(`${sheetDateStr}T00:00:00`))} · Week ${currentWeekData.weekNumber}`
    : '';

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
          <PageHeading title="Timetable" sub={`Week ${currentWeekData.weekNumber} · ${currentWeekData.displayString}`} />
          <TimetableGrid
            currentWeekData={currentWeekData}
            timetable={timetable}
            lessonPlans={lessonPlans}
            viewFilter={viewFilter}
            isReadOnly={isReadOnly}
            dayBuckets={dayBuckets}
            onOpenDayTasks={openDayTasks}
            openLessonModal={openLessonModal}
            toggleCompletion={toggleCompletion}
          />
          <WeekendSection
            currentWeekData={currentWeekData}
            weeksInTerm={weeksInTerm}
            selectedWeekIndex={selectedWeekIndex}
            terms={terms}
            selectedTermId={selectedTermId}
            flatTasks={flatTasks}
            routineTasks={routineTasks}
            projects={projects}
            globalTasks={globalTasks}
            isReadOnly={isReadOnly}
            isRoutineCompleted={isRoutineCompleted}
            expandedActiveDays={expandedActiveDays}
            expandedRoutineDays={expandedRoutineDays}
            setExpandedActiveDays={setExpandedActiveDays}
            setExpandedRoutineDays={setExpandedRoutineDays}
            toggleTaskCompletion={toggleTaskCompletion}
            handleToggleRoutineTask={handleToggleRoutineTask}
            openCardModal={openCardModal}
          />
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <TimetableDayList
          currentWeekData={currentWeekData}
          timetable={timetable}
          lessonPlans={lessonPlans}
          viewFilter={viewFilter}
          isReadOnly={isReadOnly}
          mobileDayIndex={mobileDayIndex}
          setMobileDayIndex={setMobileDayIndex}
          buckets={dayBuckets[toISODate(addDays(currentWeekData.startDate, mobileDayIndex))]}
          onOpenDayTasks={openDayTasks}
          openLessonModal={openLessonModal}
          toggleCompletion={toggleCompletion}
          onJumpToToday={jumpToToday}
          todayInWeekIndex={todayInWeekIndex}
        />
        <div className="px-4 pb-6">
          <WeekendSection
            currentWeekData={currentWeekData}
            weeksInTerm={weeksInTerm}
            selectedWeekIndex={selectedWeekIndex}
            terms={terms}
            selectedTermId={selectedTermId}
            flatTasks={flatTasks}
            routineTasks={routineTasks}
            projects={projects}
            globalTasks={globalTasks}
            isReadOnly={isReadOnly}
            isRoutineCompleted={isRoutineCompleted}
            expandedActiveDays={expandedActiveDays}
            expandedRoutineDays={expandedRoutineDays}
            setExpandedActiveDays={setExpandedActiveDays}
            setExpandedRoutineDays={setExpandedRoutineDays}
            toggleTaskCompletion={toggleTaskCompletion}
            handleToggleRoutineTask={handleToggleRoutineTask}
            openCardModal={openCardModal}
          />
        </div>
      </div>

      <DayTasksSheet
        isOpen={sheetDateStr != null}
        onClose={() => setSheetDateStr(null)}
        dateStr={sheetDateStr}
        dayLabel={sheetDayLabel}
        subtitle={sheetSubtitle}
        buckets={sheetDateStr ? dayBuckets[sheetDateStr] ?? null : null}
        projects={projects}
        globalTasks={globalTasks}
        isReadOnly={isReadOnly}
        expandedActiveDays={expandedActiveDays}
        expandedRoutineDays={expandedRoutineDays}
        setExpandedActiveDays={setExpandedActiveDays}
        setExpandedRoutineDays={setExpandedRoutineDays}
        toggleTaskCompletion={toggleTaskCompletion}
        handleToggleRoutineTask={handleToggleRoutineTask}
        openCardModal={openCardModal}
      />
    </>
  );
};

export default TimetableView;
