import re

with open("App.tsx", "r") as f:
    content = f.read()

search_block = """                                    const dailyTasks = globalTasks.filter(t => t.scheduledDateStr === dateStr || t.deadlineDateStr === dateStr);

                                    // Routine tasks logic
                                    const targetDate = addDays(currentWeekData.startDate, dayIndex);
                                    const dayOfWeek = targetDate.getDay();

                                    const applicableRoutines = routineTasks.filter(t => {
                                        if (t.type === 'daily' || !t.type) return true;
                                        return t.daysOfWeek?.includes(dayOfWeek);
                                    });

                                    const activeRoutines = applicableRoutines.filter(t => !isRoutineCompleted(t, dateStr));
                                    const completedRoutines = applicableRoutines.filter(t => isRoutineCompleted(t, dateStr));

                                    if (dailyTasks.length === 0 && applicableRoutines.length === 0) return null;

                                    return (
                                        <>
                                        {activeRoutines.map(task => ("""

replace_block = """                                    const dailyTasks = globalTasks.filter(t => t.scheduledDateStr === dateStr || t.deadlineDateStr === dateStr);

                                    // Split daily tasks into active and completed
                                    const activeDailyTasks = dailyTasks.filter(t => t.status !== 'Completed');
                                    const completedDailyTasks = dailyTasks.filter(t => t.status === 'Completed');

                                    // Routine tasks logic
                                    const targetDate = addDays(currentWeekData.startDate, dayIndex);
                                    const dayOfWeek = targetDate.getDay();

                                    const applicableRoutines = routineTasks.filter(t => {
                                        if (t.type === 'daily' || !t.type) return true;
                                        return t.daysOfWeek?.includes(dayOfWeek);
                                    });

                                    const activeRoutines = applicableRoutines.filter(t => !isRoutineCompleted(t, dateStr));
                                    const completedRoutines = applicableRoutines.filter(t => isRoutineCompleted(t, dateStr));

                                    const totalCompleted = completedRoutines.length + completedDailyTasks.length;

                                    if (dailyTasks.length === 0 && applicableRoutines.length === 0) return null;

                                    return (
                                        <>
                                        {activeRoutines.map(task => ("""

content = content.replace(search_block, replace_block)

search_block_2 = """                                        {dailyTasks.map(task => {
                                            const project = projects.find(p => p.id === task.projectId);
                                            const bgColorClass = project?.colorClass || 'bg-white dark:bg-slate-800';
                                            const isScheduled = task.scheduledDateStr === dateStr;
                                            const isDue = task.deadlineDateStr === dateStr;

                                            return (
                                                <div key={task.id}
                                                     onClick={() => openTaskModal(task)}
                                                     className={`flex items-start gap-1.5 ${bgColorClass} p-1.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm text-xs relative group/dailytask cursor-pointer hover:shadow-md transition-shadow`}>
                                                    <button
                                                        onClick={(e) => toggleTaskCompletion(e, task.id)}
                                                        className={`mt-0.5 shrink-0 ${task.status === 'Completed' ? 'text-green-500' : task.status === 'In Progress' ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                                                    >
                                                        <CheckCircle2 size={12} />
                                                    </button>
                                                    <div className="flex-1 flex flex-col min-w-0 pt-0.5">
                                                        <span className={`font-medium line-clamp-2 leading-tight ${task.status === 'Completed' ? 'line-through text-slate-400 dark:text-slate-500' : task.status === 'In Progress' ? 'text-amber-700 dark:text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                                            {task.title}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                                            {isScheduled && <span className="flex items-center gap-0.5" title="Scheduled today"><CalendarDays size={10} className="text-green-600 dark:text-green-400" /> Sch</span>}
                                                            {isDue && <span className="flex items-center gap-0.5" title="Due today"><Clock size={10} className="text-red-600 dark:text-red-400" /> Due</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {completedRoutines.length > 0 && ("""

replace_block_2 = """                                        {activeDailyTasks.map(task => {
                                            const project = projects.find(p => p.id === task.projectId);
                                            const bgColorClass = project?.colorClass || 'bg-white dark:bg-slate-800';
                                            const isScheduled = task.scheduledDateStr === dateStr;
                                            const isDue = task.deadlineDateStr === dateStr;

                                            return (
                                                <div key={task.id}
                                                     onClick={() => openTaskModal(task)}
                                                     className={`flex items-start gap-1.5 ${bgColorClass} p-1.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm text-xs relative group/dailytask cursor-pointer hover:shadow-md transition-shadow`}>
                                                    <button
                                                        onClick={(e) => toggleTaskCompletion(e, task.id)}
                                                        className={`mt-0.5 shrink-0 ${task.status === 'In Progress' ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                                                    >
                                                        <CheckCircle2 size={12} />
                                                    </button>
                                                    <div className="flex-1 flex flex-col min-w-0 pt-0.5">
                                                        <span className={`font-medium line-clamp-2 leading-tight ${task.status === 'In Progress' ? 'text-amber-700 dark:text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                                            {task.title}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                                            {isScheduled && <span className="flex items-center gap-0.5" title="Scheduled today"><CalendarDays size={10} className="text-green-600 dark:text-green-400" /> Sch</span>}
                                                            {isDue && <span className="flex items-center gap-0.5" title="Due today"><Clock size={10} className="text-red-600 dark:text-red-400" /> Due</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {totalCompleted > 0 && ("""

content = content.replace(search_block_2, replace_block_2)

search_block_3 = """                                                <button
                                                    onClick={() => setExpandedRoutineDays(prev => ({...prev, [dateStr]: !prev[dateStr]}))}
                                                    className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                                >
                                                    <span>Completed ({completedRoutines.length})</span>
                                                    {expandedRoutineDays[dateStr] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                </button>

                                                {expandedRoutineDays[dateStr] && (
                                                    <div className="space-y-1.5 mt-2">
                                                        {completedRoutines.map(task => (
                                                            <div key={task.id}
                                                                 className={`flex items-start gap-1.5 bg-slate-100/50 dark:bg-slate-800/30 p-1.5 rounded border border-slate-200/50 dark:border-slate-700/50 text-xs cursor-pointer opacity-70 hover:opacity-100 transition-opacity`}
                                                                 onClick={(e) => handleToggleRoutineTask(e, task, dateStr)}
                                                            >
                                                                <button
                                                                    className={`mt-0.5 shrink-0 text-green-500`}
                                                                >
                                                                    <CheckCircle2 size={12} />
                                                                </button>
                                                                <div className="flex-1 flex flex-col min-w-0 pt-0.5">
                                                                    <span className={`font-medium line-clamp-2 leading-tight line-through text-slate-500`}>
                                                                        {task.title}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}"""

replace_block_3 = """                                                <button
                                                    onClick={() => setExpandedRoutineDays(prev => ({...prev, [dateStr]: !prev[dateStr]}))}
                                                    className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                                >
                                                    <span>Completed ({totalCompleted})</span>
                                                    {expandedRoutineDays[dateStr] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                </button>

                                                {expandedRoutineDays[dateStr] && (
                                                    <div className="space-y-1.5 mt-2">
                                                        {/* Render completed routines */}
                                                        {completedRoutines.map(task => (
                                                            <div key={task.id}
                                                                 className={`flex items-start gap-1.5 bg-slate-100/50 dark:bg-slate-800/30 p-1.5 rounded border border-slate-200/50 dark:border-slate-700/50 text-xs cursor-pointer opacity-70 hover:opacity-100 transition-opacity`}
                                                                 onClick={(e) => handleToggleRoutineTask(e, task, dateStr)}
                                                            >
                                                                <button
                                                                    className={`mt-0.5 shrink-0 text-green-500`}
                                                                >
                                                                    <CheckCircle2 size={12} />
                                                                </button>
                                                                <div className="flex-1 flex flex-col min-w-0 pt-0.5">
                                                                    <span className={`font-medium line-clamp-2 leading-tight line-through text-slate-500`}>
                                                                        {task.title}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {/* Render completed global daily tasks */}
                                                        {completedDailyTasks.map(task => (
                                                            <div key={task.id}
                                                                 className={`flex items-start gap-1.5 bg-slate-100/50 dark:bg-slate-800/30 p-1.5 rounded border border-slate-200/50 dark:border-slate-700/50 text-xs cursor-pointer opacity-70 hover:opacity-100 transition-opacity`}
                                                                 onClick={() => openTaskModal(task)}
                                                            >
                                                                <button
                                                                    onClick={(e) => toggleTaskCompletion(e, task.id)}
                                                                    className={`mt-0.5 shrink-0 text-green-500`}
                                                                >
                                                                    <CheckCircle2 size={12} />
                                                                </button>
                                                                <div className="flex-1 flex flex-col min-w-0 pt-0.5">
                                                                    <span className={`font-medium line-clamp-2 leading-tight line-through text-slate-500`}>
                                                                        {task.title}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}"""

content = content.replace(search_block_3, replace_block_3)

with open("App.tsx", "w") as f:
    f.write(content)
