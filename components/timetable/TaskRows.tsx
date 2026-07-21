import React from 'react';
import { Circle, Clock, CheckCircle2 } from 'lucide-react';
import { Task, RoutineTask, Project } from '../../types';

/** Leading dot colour from a project's colorClass (first bg- family, forced to -400). */
export const projectDotClass = (project: Project | undefined): string => {
  const fam = project?.colorClass ? /(?:^|\s)bg-([a-z]+)-/.exec(project.colorClass)?.[1] : undefined;
  return fam ? `bg-${fam}-400` : 'bg-slate-300 dark:bg-slate-600';
};

interface TaskRowProps {
  task: Task;
  projects: Project[];
  globalTasks: Task[];
  isReadOnly: boolean;
  completed?: boolean;
  extraSub?: string;
  toggleTaskCompletion: (e: React.MouseEvent, taskId: string, parentTaskId?: string) => void;
  openCardModal: (task: Task) => void;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task, projects, globalTasks, isReadOnly, completed, extraSub, toggleTaskCompletion, openCardModal,
}) => {
  const project = projects.find(p => p.id === task.projectId);
  const subBits = [
    task._parentTaskTitle ? `↳ ${task._parentTaskTitle}` : null,
    project?.name || null,
    extraSub || null,
  ].filter(Boolean);

  const openCard = () => {
    if (task._parentTaskId) {
      const parent = globalTasks.find(t => t.id === task._parentTaskId);
      if (parent) openCardModal(parent);
    } else {
      openCardModal(task);
    }
  };

  return (
    <div className="flex items-start gap-3 py-2.5 cursor-pointer" onClick={openCard}>
      <button
        onClick={(e) => { e.stopPropagation(); if (!isReadOnly) toggleTaskCompletion(e, task.id, task._parentTaskId); }}
        className={`mt-0.5 shrink-0 ${completed ? 'text-primary-500' : task.status === 'In Progress' ? 'text-amber-500' : 'text-slate-300 hover:text-primary-500 dark:text-slate-600'} transition-colors`}
        aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {completed ? <CheckCircle2 size={16} /> : task.status === 'In Progress' ? <Clock size={16} /> : <Circle size={16} />}
      </button>
      <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${projectDotClass(project)}`} />
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{task.title}</span>
        {subBits.length > 0 && (
          <span className="block truncate text-xs text-slate-400 dark:text-slate-500">{subBits.join(' · ')}</span>
        )}
      </span>
    </div>
  );
};

interface RoutineRowProps {
  routine: RoutineTask & { targetDateStr?: string; displayDay?: string };
  dateStr: string;
  isReadOnly: boolean;
  completed?: boolean;
  handleToggleRoutineTask: (e: React.MouseEvent, task: RoutineTask, dateStr: string) => void;
}

export const RoutineRow: React.FC<RoutineRowProps> = ({ routine, dateStr, isReadOnly, completed, handleToggleRoutineTask }) => (
  <div className="flex items-start gap-3 py-2.5">
    <button
      onClick={(e) => { if (!isReadOnly) handleToggleRoutineTask(e, routine, routine.targetDateStr || dateStr); }}
      className={`mt-0.5 shrink-0 ${completed ? 'text-primary-500' : 'text-slate-300 hover:text-primary-500 dark:text-slate-600'} transition-colors`}
      aria-label={completed ? 'Mark routine incomplete' : 'Mark routine complete'}
    >
      {completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
    </button>
    <span className="min-w-0 flex-1">
      <span className={`block text-sm ${completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{routine.title}</span>
      <span className="block text-xs text-slate-400 dark:text-slate-500">{['Routine', routine.displayDay].filter(Boolean).join(' · ')}</span>
    </span>
  </div>
);
