import React, { useState, useEffect } from 'react';
import { Project, Task, Category } from '../types';
import { X, Sparkles, Loader2, Plus, Trash2, Wand2, ArrowLeft } from 'lucide-react';
import { generateVibeProject, VibeTaskDraft } from '../services/aiService';
import { saveProject, saveTask, saveCategory } from '../services/projectService';
import { getRandomCategoryColor } from '../utils/colorUtils';

interface VibeProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    categories: Category[];
    isReadOnly: boolean;
    onCreated: (project: Project, tasks: Task[], newCategory?: Category) => void;
}

const NEW_CATEGORY = '__new__';

const VibeProjectModal: React.FC<VibeProjectModalProps> = ({ isOpen, onClose, categories, isReadOnly, onCreated }) => {
    const [step, setStep] = useState<'input' | 'preview'>('input');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Editable draft state (populated after generation).
    const [projectName, setProjectName] = useState('');
    const [description, setDescription] = useState('');
    const [tasks, setTasks] = useState<VibeTaskDraft[]>([]);
    const [categoryChoice, setCategoryChoice] = useState<string>(''); // '' | category id | NEW_CATEGORY
    const [newCatName, setNewCatName] = useState('');

    const projectCategories = categories.filter(c => c.type === 'project');

    useEffect(() => {
        if (isOpen) {
            setStep('input');
            setPrompt('');
            setIsGenerating(false);
            setIsCreating(false);
            setProjectName('');
            setDescription('');
            setTasks([]);
            setCategoryChoice('');
            setNewCatName('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!prompt.trim() || isGenerating || isReadOnly) return;
        setIsGenerating(true);
        try {
            const cats = projectCategories.map(c => ({ id: c.id, name: c.name }));
            const today = new Date().toISOString().split('T')[0];
            const result = await generateVibeProject(prompt, cats, today);
            if (!result) {
                alert("Sorry, I couldn't draft a project from that. Try adding a bit more detail.");
                return;
            }
            setProjectName(result.projectName);
            setDescription(result.description);
            setTasks(result.tasks);

            const matchedExisting = result.categorySelection.existingCategoryId
                && projectCategories.some(c => c.id === result.categorySelection.existingCategoryId);
            if (matchedExisting) {
                setCategoryChoice(result.categorySelection.existingCategoryId);
                setNewCatName('');
            } else if (result.categorySelection.newCategoryName) {
                setCategoryChoice(NEW_CATEGORY);
                setNewCatName(result.categorySelection.newCategoryName);
            } else {
                setCategoryChoice('');
                setNewCatName('');
            }
            setStep('preview');
        } catch (e) {
            console.error("Vibe generate failed", e);
            alert("Sorry, something went wrong while drafting the project.");
        } finally {
            setIsGenerating(false);
        }
    };

    const updateTask = (idx: number, patch: Partial<VibeTaskDraft>) => {
        setTasks(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
    };
    const removeTask = (idx: number) => setTasks(prev => prev.filter((_, i) => i !== idx));
    const addBlankTask = () => setTasks(prev => [...prev, { title: '', description: '', priority: 'Medium', scheduledDateStr: '', deadlineDateStr: '' }]);

    const handleCreate = async () => {
        if (isReadOnly || isCreating) return;
        const cleanTasks = tasks.filter(t => t.title.trim().length > 0);
        if (!projectName.trim()) {
            alert("Please give the project a name.");
            return;
        }
        setIsCreating(true);
        try {
            let categoryId: string | undefined;
            let newCategory: Category | undefined;

            if (categoryChoice === NEW_CATEGORY && newCatName.trim()) {
                newCategory = {
                    id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: newCatName.trim(),
                    colorClass: getRandomCategoryColor(),
                    type: 'project',
                };
                await saveCategory(newCategory);
                categoryId = newCategory.id;
            } else if (categoryChoice && categoryChoice !== NEW_CATEGORY) {
                categoryId = categoryChoice;
            }

            const project: Project = {
                id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: projectName.trim(),
                description: description.trim() || undefined,
                categoryId,
                links: [],
                tasks: [],
                createdAt: Date.now(),
            };
            await saveProject(project);

            const createdTasks: Task[] = [];
            for (let i = 0; i < cleanTasks.length; i++) {
                const t = cleanTasks[i];
                const task: Task = {
                    id: `task_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
                    projectId: project.id,
                    title: t.title.trim(),
                    description: t.description?.trim() || undefined,
                    status: 'Uncompleted',
                    priority: t.priority,
                    scheduledDateStr: t.scheduledDateStr || undefined,
                    deadlineDateStr: t.deadlineDateStr || undefined,
                    subtasks: [],
                    createdAt: Date.now(),
                };
                await saveTask(task);
                createdTasks.push(task);
            }

            onCreated(project, createdTasks, newCategory);
            onClose();
        } catch (e) {
            console.error("Failed to create vibe project", e);
            alert("Sorry, something went wrong creating the project.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-black/[0.06] dark:border-white/[0.08] w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 flex justify-between items-center bg-gradient-to-r from-primary-600 to-primary-600 text-white shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Wand2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold leading-tight">Vibe a Project</h2>
                            <p className="text-xs text-primary-100">Describe it — AI drafts the project, tasks & category.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {step === 'input' ? (
                    <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Brain-dump everything you need to do. The more context you give (deadlines, who's involved, the goal), the better the draft.
                        </p>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            autoFocus
                            placeholder={"e.g. I need to organise the Year 8 parents' evening for the end of term — book the hall, send invites to parents, arrange the room layout, brief staff, and prepare a feedback form."}
                            className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 min-h-[160px] resize-y text-slate-900 dark:text-white"
                            disabled={isGenerating}
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleGenerate}
                                disabled={!prompt.trim() || isGenerating || isReadOnly}
                                className="bg-gradient-to-r from-primary-600 to-primary-600 hover:from-primary-700 hover:to-primary-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                {isGenerating ? <><Loader2 size={16} className="animate-spin" /> Drafting…</> : <><Sparkles size={16} /> Generate Project</>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                            {/* Project name */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Project Name</label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                />
                            </div>

                            {/* Description */}
                            {description && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                </div>
                            )}

                            {/* Category */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                                <select
                                    value={categoryChoice}
                                    onChange={(e) => setCategoryChoice(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                >
                                    <option value="">No category</option>
                                    {projectCategories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                    {newCatName && <option value={NEW_CATEGORY}>✨ Create new: {newCatName}</option>}
                                </select>
                                {categoryChoice === NEW_CATEGORY && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-xs text-primary-600 dark:text-primary-400 font-medium shrink-0">New category name:</span>
                                        <input
                                            type="text"
                                            value={newCatName}
                                            onChange={(e) => setNewCatName(e.target.value)}
                                            className="flex-1 bg-white dark:bg-slate-950 border border-primary-300 dark:border-primary-800 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Tasks */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tasks ({tasks.filter(t => t.title.trim()).length})</label>
                                    <button onClick={addBlankTask} className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1">
                                        <Plus size={14} /> Add task
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {tasks.map((t, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                                            <input
                                                type="text"
                                                value={t.title}
                                                onChange={(e) => updateTask(idx, { title: e.target.value })}
                                                placeholder="Task title"
                                                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none px-1 min-w-0"
                                            />
                                            <select
                                                value={t.priority}
                                                onChange={(e) => updateTask(idx, { priority: e.target.value as VibeTaskDraft['priority'] })}
                                                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-slate-600 dark:text-slate-300 shrink-0"
                                            >
                                                <option value="High">High</option>
                                                <option value="Medium">Medium</option>
                                                <option value="Low">Low</option>
                                            </select>
                                            <button onClick={() => removeTask(idx)} className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors shrink-0" title="Remove task">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {tasks.length === 0 && (
                                        <p className="text-sm text-slate-400 italic text-center py-3">No tasks — add one above.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0 bg-slate-50 dark:bg-slate-950/50">
                            <button
                                onClick={() => setStep('input')}
                                disabled={isCreating}
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <ArrowLeft size={16} /> Back
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={isCreating || isReadOnly || !projectName.trim()}
                                className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                {isCreating ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : <><Plus size={16} /> Create Project</>}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default VibeProjectModal;
