import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Sheet from '../ui/Sheet';
import SectionLabel from '../ui/SectionLabel';
import { Task, RoutineTask, Project } from '../../types';
import { DayTaskBuckets } from './useDayTasks';
import { TaskRow, RoutineRow } from './TaskRows';

interface DayTasksSheetProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string | null;
  dayLabel: string;
  subtitle: string;
  buckets: DayTaskBuckets | null;
  projects: Project[];
  globalTasks: Task[];
  isReadOnly: boolean;
  expandedActiveDays: Record<string, boolean>;
  expandedRoutineDays: Record<string, boolean>;
  setExpandedActiveDays: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setExpandedRoutineDays: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  toggleTaskCompletion: (e: React.MouseEvent, taskId: string, parentTaskId?: string) => void;
  handleToggleRoutineTask: (e: React.MouseEvent, task: RoutineTask, dateStr: string) => void;
  openCardModal: (task: Task) => void;
}

const DayTasksSheet: React.FC<DayTasksSheetProps> = ({
  isOpen, onClose, dateStr, dayLabel, subtitle, buckets,
  projects, globalTasks, isReadOnly,
  expandedActiveDays, expandedRoutineDays, setExpandedActiveDays, setExpandedRoutineDays,
  toggleTaskCompletion, handleToggleRoutineTask, openCardModal,
}) => {
  if (!dateStr || !buckets) return null;

  const { activeRoutines, completedRoutines, activeTasks, completedTasks, total, done, pct } = buckets;
  const totalActive = activeRoutines.length + activeTasks.length;
  const totalDone = completedRoutines.length + completedTasks.length;
  const isExpandedActive = expandedActiveDays[dateStr] !== false;
  const isExpandedDone = !!expandedRoutineDays[dateStr];

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={dayLabel} subtitle={subtitle}>
      {total === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Nothing scheduled for this day.</p>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="flex items-baseline justify-between">
              <SectionLabel>{done} of {total} done</SectionLabel>
              <span className="text-xs tabular-nums text-slate-400">{pct}%</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1]">
              <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {totalActive > 0 && (
            <div>
              <button
                onClick={() => setExpandedActiveDays(prev => ({ ...prev, [dateStr]: !isExpandedActive }))}
                className="flex w-full items-center justify-between py-1"
              >
                <SectionLabel>To Do ({totalActive})</SectionLabel>
                {isExpandedActive ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
              </button>
              {isExpandedActive && (
                <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                  {activeRoutines.map(r => (
                    <RoutineRow key={`r-${r.id}`} routine={r} dateStr={dateStr} isReadOnly={isReadOnly} handleToggleRoutineTask={handleToggleRoutineTask} />
                  ))}
                  {activeTasks.map(t => (
                    <TaskRow key={t.id} task={t} projects={projects} globalTasks={globalTasks} isReadOnly={isReadOnly}
                      toggleTaskCompletion={toggleTaskCompletion} openCardModal={openCardModal} />
                  ))}
                </div>
              )}
            </div>
          )}

          {totalDone > 0 && (
            <div>
              <button
                onClick={() => setExpandedRoutineDays(prev => ({ ...prev, [dateStr]: !isExpandedDone }))}
                className="flex w-full items-center justify-between py-1"
              >
                <SectionLabel>Completed ({totalDone})</SectionLabel>
                {isExpandedDone ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
              </button>
              {isExpandedDone && (
                <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                  {completedRoutines.map(r => (
                    <RoutineRow key={`r-${r.id}`} routine={r} dateStr={dateStr} isReadOnly={isReadOnly} completed handleToggleRoutineTask={handleToggleRoutineTask} />
                  ))}
                  {completedTasks.map(t => (
                    <TaskRow key={t.id} task={t} projects={projects} globalTasks={globalTasks} isReadOnly={isReadOnly} completed
                      toggleTaskCompletion={toggleTaskCompletion} openCardModal={openCardModal} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
};

export default DayTasksSheet;
