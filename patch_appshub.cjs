const fs = require('fs');

const path = 'App.tsx';
let content = fs.readFileSync(path, 'utf8');

const marker = `                    );
                    })}
                </div>
            </div>`;

const insertion = `                    );
                    })}

                    {/* Weekend Tasks Section */}
                    {(() => {
                        if (!currentWeekData) return null;

                        const saturdayDate = addDays(currentWeekData.startDate, 5);
                        const sundayDate = addDays(currentWeekData.startDate, 6);
                        const satDateStr = toISODate(saturdayDate);
                        const sunDateStr = toISODate(sundayDate);

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

                        const weekendTasks = allTasksAndSubtasks.filter(t =>
                            t.scheduledDateStr === satDateStr || t.deadlineDateStr === satDateStr ||
                            t.scheduledDateStr === sunDateStr || t.deadlineDateStr === sunDateStr
                        );

                        // Sort by priority: High > Medium > Low
                        const priorityWeight: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
                        weekendTasks.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

                        const activeWeekendTasks = weekendTasks.filter(t => t.status !== 'Completed');
                        const completedWeekendTasks = weekendTasks.filter(t => t.status === 'Completed');

                        const applicableRoutinesSat = routineTasks.filter(t => t.type === 'daily' || !t.type || t.daysOfWeek?.includes(6));
                        const applicableRoutinesSun = routineTasks.filter(t => t.type === 'daily' || !t.type || t.daysOfWeek?.includes(0));

                        const activeRoutinesSat = applicableRoutinesSat.filter(t => !isRoutineCompleted(t, satDateStr));
                        const completedRoutinesSat = applicableRoutinesSat.filter(t => isRoutineCompleted(t, satDateStr));

                        const activeRoutinesSun = applicableRoutinesSun.filter(t => !isRoutineCompleted(t, sunDateStr));
                        const completedRoutinesSun = applicableRoutinesSun.filter(t => isRoutineCompleted(t, sunDateStr));

                        const activeRoutines = [
                            ...activeRoutinesSat.map(t => ({...t, targetDateStr: satDateStr, displayDay: 'Sat'})),
                            ...activeRoutinesSun.map(t => ({...t, targetDateStr: sunDateStr, displayDay: 'Sun'}))
                        ];

                        const completedRoutines = [
                            ...completedRoutinesSat.map(t => ({...t, targetDateStr: satDateStr, displayDay: 'Sat'})),
                            ...completedRoutinesSun.map(t => ({...t, targetDateStr: sunDateStr, displayDay: 'Sun'}))
                        ];

                        const totalCompleted = completedRoutines.length + completedWeekendTasks.length;
                        const totalActive = activeRoutines.length + activeWeekendTasks.length;
                        const totalTasks = totalActive + totalCompleted;

                        if (totalTasks === 0) return null;

                        const progressPercentage = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
                        const isExpandedActive = expandedActiveDays['weekend'] !== false;

                        return (
                            <div className="col-span-9 bg-slate-200 dark:bg-slate-900 rounded-lg p-4 border border-slate-300 dark:border-slate-800 shadow-sm transition-colors mt-6">
                                <div className="flex items-center gap-2 mb-3 border-b border-slate-300 dark:border-slate-700 pb-2">
                                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Weekend Tasks</h3>
                                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">({formatDate(saturdayDate)} & {formatDate(sundayDate)})</span>
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
                                                {activeRoutines.map((task, idx) => (
                                                    <div key={\`\${task.id}_\${idx}\`}
                                                         className="flex items-start gap-2 bg-green-50/50 dark:bg-green-900/10 p-2 rounded border border-green-200/50 dark:border-green-800/50 shadow-sm text-sm relative group/dailytask cursor-pointer hover:shadow-md transition-shadow">
                                                        <button
                                                            onClick={(e) => handleToggleRoutineTask(e, task, task.targetDateStr)}
                                                            className="mt-0.5 shrink-0 text-slate-300 dark:text-slate-600 hover:text-green-500"
                                                        >
                                                            <Circle size={14} />
                                                        </button>
                                                        <div className="flex-1 flex flex-col min-w-0">
                                                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                                                {task.title}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">{task.displayDay}</span>
                                                        </div>
                                                    </div>
                                                ))}

                                                {activeWeekendTasks.map(task => {
                                                    const project = projects.find(p => p.id === task.projectId);
                                                    const bgColorClass = project?.colorClass || 'bg-white dark:bg-slate-800';
                                                    const textColorClass = project?.colorClass ? getContrastTextColor(project.colorClass) : 'text-slate-700 dark:text-slate-200';
                                                    const isSatSch = task.scheduledDateStr === satDateStr;
                                                    const isSunSch = task.scheduledDateStr === sunDateStr;
                                                    const isSatDue = task.deadlineDateStr === satDateStr;
                                                    const isSunDue = task.deadlineDateStr === sunDateStr;

                                                    const dayStr = (isSatSch || isSatDue) && (isSunSch || isSunDue) ? 'Sat & Sun' : (isSatSch || isSatDue ? 'Sat' : 'Sun');

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
                                                                    {(isSatSch || isSunSch) && <span className="flex items-center gap-0.5" title="Scheduled"><CalendarDays size={12} className={project?.colorClass ? '' : 'text-green-600 dark:text-green-400'} /> Sch</span>}
                                                                    {(isSatDue || isSunDue) && <span className="flex items-center gap-0.5" title="Due"><Clock size={12} className={project?.colorClass ? '' : 'text-red-600 dark:text-red-400'} /> Due</span>}
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
                                                {completedRoutines.map((task, idx) => (
                                                    <div key={\`\${task.id}_\${idx}\`}
                                                         className="flex items-start gap-2 bg-slate-100/50 dark:bg-slate-800/30 p-2 rounded border border-slate-200/50 dark:border-slate-700/50 text-sm cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                                                         onClick={(e) => handleToggleRoutineTask(e, task, task.targetDateStr)}
                                                    >
                                                        <button className="mt-0.5 shrink-0 text-green-500">
                                                            <CheckCircle2 size={14} />
                                                        </button>
                                                        <div className="flex-1 flex flex-col min-w-0">
                                                            <span className="font-medium line-through text-slate-500">
                                                                {task.title}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">{task.displayDay}</span>
                                                        </div>
                                                    </div>
                                                ))}

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
                    })()}
                </div>
            </div>`;

content = content.replace(marker, insertion);
fs.writeFileSync(path, content);
