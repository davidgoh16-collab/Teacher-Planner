import React, { useState, useEffect, useMemo } from 'react';
import { Users2, CalendarDays, FolderKanban, Layers, Loader2, Check, ChevronRight, Eye, Pencil } from 'lucide-react';
import { WeeklyTimetable, TimetableEntry, Project, Task } from '../types';
import { DAYS, PERIOD_LABELS } from '../constants';
import { getEntryStyle, getEntryClassName } from '../utils/colorUtils';
import {
  Share, listSharesWithMe, fetchOwnerTimetable, fetchOwnerProject, saveOwnerTask,
} from '../services/shareService';

interface SharedViewProps {
  uid: string;
  myWeek1: WeeklyTimetable;
  myWeek2: WeeklyTimetable;
}

interface OwnerGroup {
  ownerUid: string;
  ownerName: string;
  ownerEmail: string;
  timetableShare?: Share;
  projectShares: Share[];
}

const GRID_PERIODS = PERIOD_LABELS.filter(p => !p.includes('Mtg'));

const entryAt = (tt: WeeklyTimetable | null | undefined, day: string, period: string): TimetableEntry | null =>
  (tt && tt[day] && tt[day][period]) || null;

const isFree = (entry: TimetableEntry | null): boolean =>
  !entry || !entry.subject || entry.subject.toUpperCase().includes('PPA');

const SharedView: React.FC<SharedViewProps> = ({ uid, myWeek1, myWeek2 }) => {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);

  // Timetable viewing state
  const [ownerTimetable, setOwnerTimetable] = useState<{ week1: WeeklyTimetable; week2: WeeklyTimetable } | null>(null);
  const [ttLoading, setTtLoading] = useState(false);
  const [week, setWeek] = useState<1 | 2>(1);
  const [overlay, setOverlay] = useState(false);

  // Project viewing state
  const [openProject, setOpenProject] = useState<Share | null>(null);
  const [projectData, setProjectData] = useState<{ project: Project | null; tasks: Task[] } | null>(null);
  const [projLoading, setProjLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await listSharesWithMe(uid);
      setShares(list);
      setLoading(false);
    })();
  }, [uid]);

  const groups = useMemo<OwnerGroup[]>(() => {
    const map = new Map<string, OwnerGroup>();
    for (const s of shares) {
      let g = map.get(s.ownerUid);
      if (!g) {
        g = { ownerUid: s.ownerUid, ownerName: s.ownerName, ownerEmail: s.ownerEmail, projectShares: [] };
        map.set(s.ownerUid, g);
      }
      if (s.type === 'timetable') g.timetableShare = s;
      else g.projectShares.push(s);
    }
    return Array.from(map.values());
  }, [shares]);

  // Default-select the first owner once loaded.
  useEffect(() => {
    if (!selectedOwner && groups.length > 0) setSelectedOwner(groups[0].ownerUid);
  }, [groups, selectedOwner]);

  const current = groups.find(g => g.ownerUid === selectedOwner) || null;

  // Load the selected owner's timetable when applicable.
  useEffect(() => {
    setOwnerTimetable(null);
    setOpenProject(null);
    setProjectData(null);
    setOverlay(false);
    if (current?.timetableShare) {
      setTtLoading(true);
      fetchOwnerTimetable(current.ownerUid).then(res => {
        setOwnerTimetable(res ? { week1: res.week1, week2: res.week2 } : { week1: {}, week2: {} });
        setTtLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOwner]);

  const openSharedProject = async (share: Share) => {
    setOpenProject(share);
    setProjLoading(true);
    const data = await fetchOwnerProject(share.ownerUid, share.resourceId);
    setProjectData(data);
    setProjLoading(false);
  };

  const toggleTaskDone = async (share: Share, task: Task) => {
    if (share.permission !== 'edit') return;
    const updated: Task = {
      ...task,
      status: task.status === 'Completed' ? 'Uncompleted' : 'Completed',
      completedAt: task.status === 'Completed' ? undefined : Date.now(),
    };
    setProjectData(prev => prev ? { ...prev, tasks: prev.tasks.map(t => t.id === task.id ? updated : t) } : prev);
    try { await saveOwnerTask(share.ownerUid, updated); } catch (e) { console.error(e); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Layers className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Nothing shared with you yet</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mt-1">
          When a colleague shares their timetable or a project with your email, it will appear here.
        </p>
      </div>
    );
  }

  const myTt = week === 1 ? myWeek1 : myWeek2;
  const theirTt = ownerTimetable ? (week === 1 ? ownerTimetable.week1 : ownerTimetable.week2) : {};

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <Users2 className="w-5 h-5" /> Shared with me
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        {/* People list */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-2 h-max">
          {groups.map(g => (
            <button
              key={g.ownerUid}
              onClick={() => setSelectedOwner(g.ownerUid)}
              className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${selectedOwner === g.ownerUid ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-200'}`}
            >
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                {(g.ownerName || g.ownerEmail || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{g.ownerName || g.ownerEmail}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {[g.timetableShare ? 'Timetable' : null, g.projectShares.length ? `${g.projectShares.length} project${g.projectShares.length === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Detail pane */}
        <div className="space-y-6 min-w-0">
          {current && (
            <>
              {/* Timetable */}
              {current.timetableShare && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" /> {current.ownerName || current.ownerEmail}'s timetable
                    </h3>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} className="accent-primary-600" />
                        Overlay my timetable
                      </label>
                      <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-lg">
                        <button onClick={() => setWeek(1)} className={`px-2.5 py-1 text-xs font-medium rounded-md ${week === 1 ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Week 1</button>
                        <button onClick={() => setWeek(2)} className={`px-2.5 py-1 text-xs font-medium rounded-md ${week === 2 ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>Week 2</button>
                      </div>
                    </div>
                  </div>

                  {ttLoading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-slate-900/50 dark:text-gray-400">
                          <tr>
                            <th className="px-3 py-2 text-left">Period</th>
                            {DAYS.map(d => <th key={d} className="px-3 py-2 text-left">{d}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {GRID_PERIODS.map(period => (
                            <tr key={period} className="border-b border-gray-100 dark:border-slate-700 last:border-0">
                              <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{period}</td>
                              {DAYS.map(day => {
                                const their = entryAt(theirTt, day, period);
                                const mine = entryAt(myTt, day, period);
                                const bothFree = overlay && isFree(their) && isFree(mine);
                                return (
                                  <td key={day} className={`px-2 py-2 border-l border-gray-100 dark:border-slate-700 align-top ${bothFree ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                                    {bothFree ? (
                                      <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">Both free</span>
                                    ) : their ? (
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${getEntryClassName(their)}`} style={getEntryStyle(their)}>
                                        {their.subject}{their.room ? ` · ${their.room}` : ''}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-gray-400">Free</span>
                                    )}
                                    {overlay && !bothFree && mine && !isFree(mine) && (
                                      <p className="text-[10px] text-gray-400 mt-0.5 italic truncate">you: {mine.subject}</p>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Projects */}
              {current.projectShares.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 space-y-3">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <FolderKanban className="w-4 h-4" /> Shared projects
                  </h3>
                  <div className="grid gap-2">
                    {current.projectShares.map(s => (
                      <button
                        key={s.id}
                        onClick={() => openSharedProject(s)}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 text-left"
                      >
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{s.resourceName}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${s.permission === 'edit' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-300'}`}>
                            {s.permission === 'edit' ? <><Pencil size={10} /> Can edit</> : <><Eye size={10} /> View</>}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Shared project modal (read-only, with task toggle for edit permission) */}
      {openProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setOpenProject(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate">{openProject.resourceName}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Shared by {openProject.ownerName || openProject.ownerEmail} · {openProject.permission === 'edit' ? 'You can edit tasks' : 'Read-only'}</p>
              </div>
              <button onClick={() => setOpenProject(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none px-2">×</button>
            </div>
            <div className="p-5 overflow-y-auto">
              {projLoading ? (
                <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : !projectData?.project ? (
                <p className="text-sm text-gray-500">This project is no longer available.</p>
              ) : (
                <div className="space-y-4">
                  {projectData.project.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{projectData.project.description}</p>
                  )}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tasks ({projectData.tasks.length})</p>
                    {projectData.tasks.length === 0 && <p className="text-sm text-gray-400 italic">No tasks.</p>}
                    {projectData.tasks.map(task => (
                      <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-900/40">
                        <button
                          onClick={() => toggleTaskDone(openProject, task)}
                          disabled={openProject.permission !== 'edit'}
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${task.status === 'Completed' ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 dark:border-slate-600'} ${openProject.permission === 'edit' ? 'cursor-pointer' : 'cursor-default'}`}
                          title={openProject.permission === 'edit' ? 'Toggle complete' : 'Read-only'}
                        >
                          {task.status === 'Completed' && <Check size={12} />}
                        </button>
                        <span className={`text-sm flex-1 ${task.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>{task.title}</span>
                        <span className="text-[10px] text-gray-400">{task.priority}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedView;
