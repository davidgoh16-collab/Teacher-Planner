const fs = require('fs');

const path = 'App.tsx';
let content = fs.readFileSync(path, 'utf8');

// The marker we want to replace is the entire block starting from the Weekend Tasks Section down to the closing div of the col-span-9
// We can use a regex or string replacement. Let's find the start and end indices.

const startMarker = `                    {/* Weekend Tasks Section */}`;
const endMarker = `                        );
                    })()}`;

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex) + endMarker.length;

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find markers!");
    process.exit(1);
}

const originalBlock = content.substring(startIndex, endIndex);

const newBlock = `                    {/* Weekend Tasks Section */}
                    {(() => {
                        if (!currentWeekData) return null;

                        const saturdayDate = addDays(currentWeekData.startDate, 5);
                        const sundayDate = addDays(currentWeekData.startDate, 6);
                        const satDateStr = toISODate(saturdayDate);
                        const sunDateStr = toISODate(sundayDate);

                        // Calculate if this week is the first week of a term, or first week after half-term
                        let holidayStartStr = null;
                        let holidayEndStr = null;

                        // 1. Is it the first week of the term?
                        const currentTermIdx = terms.findIndex(t => t.id === selectedTermId);
                        const currentTerm = terms[currentTermIdx];
                        const isFirstWeekOfTerm = currentTerm && currentWeekData.startDate.getTime() === getMonday(currentTerm.startDate).getTime();

                        if (isFirstWeekOfTerm && currentTermIdx > 0) {
                            // Find the previous term
                            const prevTerm = terms[currentTermIdx - 1];
                            holidayStartStr = toISODate(addDays(prevTerm.endDate, 1));
                            holidayEndStr = toISODate(addDays(currentWeekData.startDate, -1)); // Day before this week starts
                        }

                        // 2. Is it the first week after half-term?
                        let isFirstWeekAfterHalfTerm = false;
                        if (currentTerm && currentTerm.halfTermEnd) {
                            const mondayAfterHalfTerm = getMonday(addDays(currentTerm.halfTermEnd, 1));
                            if (currentWeekData.startDate.getTime() === mondayAfterHalfTerm.getTime()) {
                                isFirstWeekAfterHalfTerm = true;
                                holidayStartStr = toISODate(currentTerm.halfTermStart!);
                                holidayEndStr = toISODate(currentTerm.halfTermEnd!);
                            }
                        }

                        const allTasksAndSubtasks = globalTasks.flatMap(task => [
                            task,
                            ...(task.subtasks || []).map(st => ({
                                ...st,
                                _isSubtaskDisplay: true,
                                _parentTaskId: task.id,
                                _parentTaskTitle: task.title,
                                projectId: task.projectId,
                                scheduledDateStr: st.scheduledDateStr || task.scheduledDateStr,
                                deadlineDateStr: st.deadlineDateStr || task.deadlineDateStr,
                                priority: st.priority || task.priority
                            } as Task))
                        ]);

                        const weekendTasks = allTasksAndSubtasks.filter(t => {
                            const isSatOrSun = t.scheduledDateStr === satDateStr || t.deadlineDateStr === satDateStr ||
                                               t.scheduledDateStr === sunDateStr || t.deadlineDateStr === sunDateStr;

                            let isHoliday = false;
                            if (holidayStartStr && holidayEndStr) {
                                if (t.scheduledDateStr && t.scheduledDateStr >= holidayStartStr && t.scheduledDateStr <= holidayEndStr) isHoliday = true;
                                if (t.deadlineDateStr && t.deadlineDateStr >= holidayStartStr && t.deadlineDateStr <= holidayEndStr) isHoliday = true;
                            }

                            return isSatOrSun || isHoliday;
                        });

                        // Sort by priority: High > Medium > Low
                        const priorityWeight: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
                        weekendTasks.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

                        const activeWeekendTasks = weekendTasks.filter(t => t.status !== 'Completed');
                        const completedWeekendTasks = weekendTasks.filter(t => t.status === 'Completed');

                        const totalCompleted = completedWeekendTasks.length;
                        const totalActive = activeWeekendTasks.length;
                        const totalTasks = totalActive + totalCompleted;

                        if (totalTasks === 0) return null;

                        const progressPercentage = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
                        const isExpandedActive = expandedActiveDays['weekend'] !== false;

                        return (
                            <div className="col-span-9 bg-slate-200 dark:bg-slate-900 rounded-lg p-4 border border-slate-300 dark:border-slate-800 shadow-sm transition-colors mt-6">
                                <div className="flex items-center gap-2 mb-3 border-b border-slate-300 dark:border-slate-700 pb-2">
                                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Weekend Tasks</h3>
                                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                                        ({formatDate(saturdayDate)} & {formatDate(sundayDate)}
                                        {holidayStartStr ? \` + Holidays\` : ''})
                                    </span>
                                </div>

                                <div className="mb-4">
                                    <div className="flex justify-between items-center text-xs text-slate-500 font-medium mb-1">
                                        <span>{totalCompleted}/{totalTasks} Completed</span>
                                        <span>{progressPercentage}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-300 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: \`\${progressPercentage}%\` }}
                                        />
                                    </div>
                                </div>

                                {totalActive > 0 && (
                                    <div className="mb-4">
                                        <button
                                            onClick={() => setExpandedActiveDays(prev => ({...prev, 'weekend': !isExpandedActive}))}
                                            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-2"
                                        >
                                            <span>To Do ({totalActive})</span>
                                            {isExpandedActive ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>

                                        {isExpandedActive && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                                {activeWeekendTasks.map(task => {
                                                    const project = projects.find(p => p.id === task.projectId);
                                                    const bgColorClass = project?.colorClass || 'bg-white dark:bg-slate-800';
                                                    const textColorClass = project?.colorClass ? getContrastTextColor(project.colorClass) : 'text-slate-700 dark:text-slate-200';
                                                    const isSatSch = task.scheduledDateStr === satDateStr;
                                                    const isSunSch = task.scheduledDateStr === sunDateStr;
                                                    const isSatDue = task.deadlineDateStr === satDateStr;
                                                    const isSunDue = task.deadlineDateStr === sunDateStr;

                                                    let isHolSch = false;
                                                    let isHolDue = false;
                                                    if (holidayStartStr && holidayEndStr) {
                                                        if (task.scheduledDateStr && task.scheduledDateStr >= holidayStartStr && task.scheduledDateStr <= holidayEndStr) isHolSch = true;
                                                        if (task.deadlineDateStr && task.deadlineDateStr >= holidayStartStr && task.deadlineDateStr <= holidayEndStr) isHolDue = true;
                                                    }

                                                    let dayStr = '';
                                                    if ((isSatSch || isSatDue) && (isSunSch || isSunDue)) dayStr = 'Sat & Sun';
                                                    else if (isSatSch || isSatDue) dayStr = 'Sat';
                                                    else if (isSunSch || isSunDue) dayStr = 'Sun';
                                                    else if (isHolSch || isHolDue) dayStr = 'Holiday';

                                                    return (
                                                        <div key={task.id}
                                                             onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (task._parentTaskId) {
                                                                    const parent = globalTasks.find(t => t.id === task._parentTaskId);
                                                                    if (parent) openCardModal(parent);
                                                                } else {
                                                                    openCardModal(task);
                                                                }
                                                             }}
                                                             className={\`flex items-start gap-2 \${bgColorClass} p-2 rounded border border-slate-200 dark:border-slate-700 shadow-sm text-sm relative group/dailytask cursor-pointer hover:shadow-md transition-shadow\`}>
                                                            <button
                                                                onClick={(e) => toggleTaskCompletion(e, task.id, task._parentTaskId)}
                                                                className={\`mt-0.5 shrink-0 \${task.status === 'In Progress' ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}\`}
                                                            >
                                                                {task.status === 'In Progress' ? <Clock size={14} /> : <Circle size={14} />}
                                                            </button>
                                                            <div className="flex-1 flex flex-col min-w-0">
                                                                {task._isSubtaskDisplay && (
                                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5 truncate">
                                                                        ↳ {task._parentTaskTitle}
                                                                    </span>
                                                                )}
                                                                <span className={\`font-medium \${task.status === 'In Progress' ? 'text-amber-700 dark:text-amber-500' : textColorClass}\`}>
                                                                    {task.title}
                                                                </span>
                                                                <div className={\`flex items-center gap-2 mt-1 text-[11px] \${project?.colorClass ? textColorClass + ' opacity-80' : 'text-slate-500 dark:text-slate-400'}\`}>
                                                                    <span className="font-bold">{dayStr}</span>
                                                                    <span className="opacity-50">|</span>
                                                                    <span className="font-semibold">{task.priority}</span>
                                                                    <span className="opacity-50">|</span>
                                                                    {(isSatSch || isSunSch || isHolSch) && <span className="flex items-center gap-0.5" title="Scheduled"><CalendarDays size={12} className={project?.colorClass ? '' : 'text-green-600 dark:text-green-400'} /> Sch</span>}
                                                                    {(isSatDue || isSunDue || isHolDue) && <span className="flex items-center gap-0.5" title="Due"><Clock size={12} className={project?.colorClass ? '' : 'text-red-600 dark:text-red-400'} /> Due</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {totalCompleted > 0 && (
                                    <div className="pt-3 border-t border-slate-300 dark:border-slate-700/50">
                                        <button
                                            onClick={() => setExpandedRoutineDays(prev => ({...prev, 'weekend': !prev['weekend']}))}
                                            className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                        >
                                            <span>Completed ({totalCompleted})</span>
                                            {expandedRoutineDays['weekend'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>

                                        {expandedRoutineDays['weekend'] && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mt-3">
                                                {completedWeekendTasks.map(task => (
                                                    <div key={task.id}
                                                         className="flex items-start gap-2 bg-slate-100/50 dark:bg-slate-800/30 p-2 rounded border border-slate-200/50 dark:border-slate-700/50 text-sm cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                                                         onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (task._parentTaskId) {
                                                                const parent = globalTasks.find(t => t.id === task._parentTaskId);
                                                                if (parent) openCardModal(parent);
                                                            } else {
                                                                openCardModal(task);
                                                            }
                                                         }}
                                                    >
                                                        <button
                                                            onClick={(e) => toggleTaskCompletion(e, task.id, task._parentTaskId)}
                                                            className="mt-0.5 shrink-0 text-green-500"
                                                        >
                                                            <CheckCircle2 size={14} />
                                                        </button>
                                                        <div className="flex-1 flex flex-col min-w-0">
                                                            {task._isSubtaskDisplay && (
                                                                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5 truncate">
                                                                    ↳ {task._parentTaskTitle}
                                                                </span>
                                                            )}
                                                            <span className="font-medium line-through text-slate-500">
                                                                {task.title}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}`;

const updatedContent = content.substring(0, startIndex) + newBlock + content.substring(endIndex);
fs.writeFileSync(path, updatedContent);
