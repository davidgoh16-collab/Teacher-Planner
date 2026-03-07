const fs = require('fs');

function applyCheckboxes() {
    let gtv = fs.readFileSync('components/GlobalTasksView.tsx', 'utf8');
    let pv = fs.readFileSync('components/ProjectView.tsx', 'utf8');

    // Bulk Fixes
    // Matrix TaskCard toggle logic is clean
    const cb = `
                            <input
                                type="checkbox"
                                checked={selectedTaskIds.has(task.id)}
                                onChange={(e) => toggleTaskSelection(task.id, e as any)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1.5 shrink-0 w-4 h-4 text-green-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-green-500 cursor-pointer"
                            />`;

    // Timeline/Matrix container
    gtv = gtv.replace(/<div className="flex items-start gap-2 flex-1 min-w-0">/g, `<div className="flex items-start gap-2 flex-1 min-w-0">${cb}`);
    gtv = gtv.replace(/<div className="flex items-start gap-3 flex-1 min-w-0">/g, `<div className="flex items-start gap-3 flex-1 min-w-0">${cb}`);
    fs.writeFileSync('components/GlobalTasksView.tsx', gtv);

    pv = pv.replace(/<div className="flex items-start gap-2 flex-1 min-w-0">/g, `<div className="flex items-start gap-2 flex-1 min-w-0">${cb}`);
    pv = pv.replace(/<div className="flex items-start gap-3 flex-1 min-w-0">/g, `<div className="flex items-start gap-3 flex-1 min-w-0">${cb}`);
    pv = pv.replace(/<div className="flex items-start gap-4">/g, `<div className="flex items-start gap-4">${cb.replace('mt-1.5', 'mt-2')}`);
    fs.writeFileSync('components/ProjectView.tsx', pv);
}

function applyGeneral() {
    let pp = fs.readFileSync('components/ProjectPlanner.tsx', 'utf8');
    const newBlock = `
                                            {/* General Tasks Card */}
                                            {catId !== 'uncategorized' && (
                                                <div className="group flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm transition-all duration-200 overflow-hidden">
                                                    <div className="p-5 pb-4 border-b border-slate-200 dark:border-slate-700/50">
                                                        <div className="flex justify-between items-start gap-2 mb-2">
                                                            <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300 line-clamp-2 leading-tight flex items-center gap-2">
                                                                <Filter size={18} className="text-slate-400" /> General Tasks
                                                            </h3>
                                                        </div>
                                                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                            Unassigned
                                                        </span>
                                                    </div>
                                                    <div className="p-4 flex-1 flex flex-col">
                                                        <ul className="space-y-2 mb-4 flex-1">
                                                            {allTasks.filter(t => t.categoryId === catId && (!t.projectId || t.projectId === '')).slice(0, 3).map(task => (
                                                                <li key={task.id} className="text-sm text-slate-600 dark:text-slate-400 truncate flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                                                    {task.title}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <button onClick={(e) => { e.stopPropagation(); setAddingGeneralTaskCategory(catId); setIsTaskModalOpen(true); }} className="mt-auto w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                                            <Plus size={16} /> Add Task
                                                        </button>
                                                    </div>
                                                </div>
                                            )}`;
    pp = pp.replace(/<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">/, '<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">\n' + newBlock);

    pp = pp.replace(/const \[newProjectCategory, setNewProjectCategory\] = useState\(''\);/, `const [newProjectCategory, setNewProjectCategory] = useState('');\n  const [addingGeneralTaskCategory, setAddingGeneralTaskCategory] = useState<string | null>(null);`);
    pp = pp.replace(/task={convertingIdea \? {[\s\S]*?} : null}/, `task={convertingIdea ? { id: \`task_\${Date.now()}\`, projectId: convertingIdea.projectId || '', title: convertingIdea.text.split('\\n')[0].substring(0, 50), description: convertingIdea.text, status: 'Uncompleted', priority: 'Medium' } : addingGeneralTaskCategory ? { id: \`task_\${Date.now()}\`, projectId: '', categoryId: addingGeneralTaskCategory, title: '', status: 'Uncompleted', priority: 'Medium' } as Task : null} projects={projects}`);

    pp = pp.replace(/const handleSaveConvertedTask = async \(task: Task\) => {[\s\S]*?if \(isReadOnly \|\| !convertingIdea\) return;/, `const handleSaveConvertedTask = async (task: Task) => { if (isReadOnly) return; if (!convertingIdea && !addingGeneralTaskCategory) return;`);
    pp = pp.replace(/await deleteIdea\(convertingIdea\.id\);/, `if (convertingIdea) await deleteIdea(convertingIdea.id);`);
    pp = pp.replace(/setIdeas\(prev => prev\.filter\(i => i\.id !== convertingIdea\.id\)\);/, `if (convertingIdea) setIdeas(prev => prev.filter(i => i.id !== convertingIdea.id));`);
    pp = pp.replace(/setConvertingIdea\(null\);/, `setConvertingIdea(null); setAddingGeneralTaskCategory(null);`);

    // Stop scroll jump
    pp = pp.replace(/onTaskUpdate=\{\(\) => loadData\(\)\}/g, `onTaskUpdate={() => {
        // Prevent refresh scroll jump, assume components handle local state
    }}`);

    // Add Routines Tab
    pp = pp.replace(/const \[activeTab, setActiveTab\] = useState<'projects' \| 'tasks' \| 'ideas'>\('projects'\);/, `const [activeTab, setActiveTab] = useState<'projects' | 'tasks' | 'ideas' | 'routines'>('projects');`);
    pp = pp.replace(/import TaskEditModal from '\.\/TaskEditModal';/, `import TaskEditModal from './TaskEditModal';\nimport RoutineTasksView from './RoutineTasksView';`);
    pp = pp.replace(/Lightbulb\n} from 'lucide-react';/, `Lightbulb,\n  RotateCw\n} from 'lucide-react';`);

    const routineTabBtn = `
                <button
                    onClick={() => setActiveTab('routines')}
                    className={\`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 \${activeTab === 'routines' ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}\`}
                >
                    <RotateCw size={16} /> Routines
                </button>`;
    pp = pp.replace(/<Lightbulb size=\{16\} \/> Ideas\n                <\/button>/, `<Lightbulb size={16} /> Ideas\n                </button>` + routineTabBtn);
    pp = pp.replace(/\) : activeTab === 'projects' \? \(/, `) : activeTab === 'routines' ? (\n        <RoutineTasksView isReadOnly={isReadOnly} />\n      ) : activeTab === 'projects' ? (`);

    fs.writeFileSync('components/ProjectPlanner.tsx', pp);
}

function applyModal() {
    let tm = fs.readFileSync('components/TaskEditModal.tsx', 'utf8');
    tm = tm.replace(/const \[categoryId, setCategoryId\] = useState\(''\);/, `const [categoryId, setCategoryId] = useState('');\n    const [projectId, setProjectId] = useState('');`);
    tm = tm.replace(/setCategoryId\(task.categoryId \|\| ''\);/, `setCategoryId(task.categoryId || '');\n            setProjectId(task.projectId || '');`);
    tm = tm.replace(/const updatedTask: Task = {/, `const updatedTask: Task = {\n            ...task,\n            projectId: projectId || '',`);
    tm = tm.replace(/interface TaskEditModalProps {/, `interface TaskEditModalProps {\n    projects?: Project[];`);
    tm = tm.replace(/task, categories, onSave }\) => {/, `task, categories, projects = [], onSave }) => {`);
    const projectSelect = `
                            {projects && projects.length > 0 && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Project</label>
                                    <select
                                        value={projectId}
                                        onChange={(e) => setProjectId(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                    >
                                        <option value="">General (No Project)</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            )}
`;
    tm = tm.replace(/<div className="grid grid-cols-1 md:grid-cols-2 gap-4">/, '<div className="grid grid-cols-1 md:grid-cols-2 gap-4">\n' + projectSelect);
    fs.writeFileSync('components/TaskEditModal.tsx', tm);
}

function applyTypes() {
    let types = fs.readFileSync('types.ts', 'utf8');
    if (!types.includes('export interface RoutineTask')) {
        types += `\nexport interface RoutineTask {\n  id: string;\n  title: string;\n  priority: 'High' | 'Medium' | 'Low';\n  lastCompletedDateStr?: string;\n  createdAt: number;\n}\n`;
        fs.writeFileSync('types.ts', types);
    }

    let svc = fs.readFileSync('services/projectService.ts', 'utf8');
    if (!svc.includes('fetchRoutineTasks')) {
        svc += `
import { RoutineTask } from '../types';

export const fetchRoutineTasks = async (): Promise<RoutineTask[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'teacher_planner_routine_tasks'));
    return querySnapshot.docs.map(docSnap => docSnap.data() as RoutineTask);
  } catch (e) {
    console.error("Error fetching routine tasks", e);
    return [];
  }
};

export const saveRoutineTask = async (task: RoutineTask): Promise<void> => {
  try {
    await setDoc(doc(db, 'teacher_planner_routine_tasks', task.id), task);
  } catch (e) {
    console.error("Error saving routine task", e);
  }
};

export const deleteRoutineTask = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'teacher_planner_routine_tasks', id));
  } catch (e) {
    console.error("Error deleting routine task", e);
  }
};
`;
        fs.writeFileSync('services/projectService.ts', svc);
    }
}

applyCheckboxes();
applyGeneral();
applyModal();
applyTypes();
