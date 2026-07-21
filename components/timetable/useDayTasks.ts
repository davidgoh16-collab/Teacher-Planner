import { useMemo } from 'react';
import { Task, RoutineTask } from '../../types';

export interface DayTaskBuckets {
  activeRoutines: RoutineTask[];
  completedRoutines: RoutineTask[];
  activeTasks: Task[];
  completedTasks: Task[];
  total: number;
  done: number;
  pct: number;
}

/** Flatten tasks + subtasks the same way the old day-card did (subtasks inherit project/dates/priority). */
export const useFlatTasks = (globalTasks: Task[]): Task[] =>
  useMemo(
    () =>
      globalTasks.flatMap(task => [
        task,
        ...(task.subtasks || []).map(st => ({
          ...st,
          _isSubtaskDisplay: true,
          _parentTaskId: task.id,
          _parentTaskTitle: task.title,
          projectId: task.projectId,
          scheduledDateStr: st.scheduledDateStr || task.scheduledDateStr,
          deadlineDateStr: st.deadlineDateStr || task.deadlineDateStr,
          priority: st.priority || task.priority,
        } as Task)),
      ]),
    [globalTasks]
  );

/** Derive a single day's task buckets (daily tasks + routines) for a dateStr. */
export const getDayTaskBuckets = (
  flatTasks: Task[],
  routineTasks: RoutineTask[],
  dateStr: string,
  dayOfWeek: number,
  isRoutineCompleted: (task: RoutineTask, dateStr: string) => boolean
): DayTaskBuckets => {
  const dailyTasks = flatTasks.filter(t => t.scheduledDateStr === dateStr || t.deadlineDateStr === dateStr);
  const activeTasks = dailyTasks.filter(t => t.status !== 'Completed');
  const completedTasks = dailyTasks.filter(t => t.status === 'Completed');

  const applicableRoutines = routineTasks.filter(t => {
    if (t.type === 'daily' || !t.type) return true;
    return t.daysOfWeek?.includes(dayOfWeek);
  });
  const activeRoutines = applicableRoutines.filter(t => !isRoutineCompleted(t, dateStr));
  const completedRoutines = applicableRoutines.filter(t => isRoutineCompleted(t, dateStr));

  const done = completedRoutines.length + completedTasks.length;
  const total = done + activeRoutines.length + activeTasks.length;
  return {
    activeRoutines,
    completedRoutines,
    activeTasks,
    completedTasks,
    total,
    done,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
  };
};
