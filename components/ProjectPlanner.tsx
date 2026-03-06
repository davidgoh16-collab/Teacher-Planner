import React, { useState, useEffect } from 'react';
import { Project, Category, Task } from '../types';
import { fetchProjects, fetchCategories, fetchTasks, saveProject, deleteProject, fetchIdeas, deleteIdea, saveTask } from '../services/projectService';
import ManageCategoriesModal from './ManageCategoriesModal';
import {
  Plus,
  Search,
  Settings,
  FolderKanban,
  Filter,
  Clock,
  Trash2,
  CalendarDays,
  MoreVertical,
  Briefcase,
  X,
  Lightbulb,
  RotateCw
} from 'lucide-react';
import ProjectView from './ProjectView';
import GlobalTasksView from './GlobalTasksView';
import AIInsightsPanel from './AIInsightsPanel';
import TaskEditModal from './TaskEditModal';
import RoutineTasksView from './RoutineTasksView';
import { Idea } from '../types';

interface ProjectPlannerProps {
  isReadOnly: boolean;
}

const ProjectPlanner: React.FC<ProjectPlannerProps> = ({ isReadOnly }) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'tasks' | 'ideas' | 'routines'>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  const [convertingIdea, setConvertingIdea] = useState<Idea | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Search & Filter state for Projects List
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [selectedProjectCategory, setSelectedProjectCategory] = useState<string>('All');

  // Modals
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // New Project Form State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState('');
  const [addingGeneralTaskCategory, setAddingGeneralTaskCategory] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedProjects, fetchedCategories, fetchedTasks, fetchedIdeas] = await Promise.all([
        fetchProjects(),
        fetchCategories(),
        fetchTasks(),
        fetchIdeas()
      ]);
      setProjects(fetchedProjects);
      setCategories(fetchedCategories);
      setAllTasks(fetchedTasks);
      setIdeas(fetchedIdeas);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIdea = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;
    try {
        await deleteIdea(id);
        setIdeas(prev => prev.filter(i => i.id !== id));
    } catch (e) {
        console.error("Failed to delete idea", e);
    }
  };

  const handleConvertIdeaToTask = (idea: Idea) => {
      setConvertingIdea(idea);
      setIsTaskModalOpen(true);
  };

  const handleSaveConvertedTask = async (task: Task) => { if (isReadOnly) return; if (!convertingIdea && !addingGeneralTaskCategory) return;
      try {
          await saveTask(task);
          if (convertingIdea) await deleteIdea(convertingIdea.id);

          setAllTasks(prev => [task, ...prev]);
          if (convertingIdea) setIdeas(prev => prev.filter(i => i.id !== convertingIdea.id));
      } catch (e) {
          console.error("Failed to convert idea to task", e);
      } finally {
          setIsTaskModalOpen(false);
          setConvertingIdea(null); setAddingGeneralTaskCategory(null);
      }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !newProjectName.trim()) return;

    const newProject: Project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newProjectName.trim(),
      description: newProjectDesc.trim(),
      categoryId: newProjectCategory || undefined,
      links: [],
      tasks: [], // We manage tasks separately, but good for local state if needed
      createdAt: Date.now()
    };

    try {
      await saveProject(newProject);
    } catch (e) {
      console.error("Failed to create project in backend", e);
    } finally {
      // For local testing, always update state
      setProjects([newProject, ...projects]);
      setIsCreateProjectOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectCategory('');
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;

    if (window.confirm("Are you sure you want to delete this project? All associated tasks will remain orphaned or should be deleted manually.")) {
        try {
            await deleteProject(id);
            setProjects(projects.filter(p => p.id !== id));
            if (selectedProjectId === id) setSelectedProjectId(null);
        } catch (e) {
            console.error("Failed to delete project", e);
            alert("Failed to delete project.");
        }
    }
  };

  // Derived state for the lists
  const projectCategories = categories.filter(c => c.type === 'project');

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(projectSearchQuery.toLowerCase());
    const matchesCategory = selectedProjectCategory === 'All' || p.categoryId === selectedProjectCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryClass = (catId?: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.colorClass : 'bg-slate-100 text-slate-800 border-slate-300';
  };

  const getCategoryName = (catId?: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : 'Uncategorized';
  };

  // If a specific project is selected, render its detail view
  if (selectedProjectId) {
    const project = projects.find(p => p.id === selectedProjectId);
    if (project) {
        return (
            <ProjectView
                project={project}
                allCategories={categories}
                allTasks={allTasks.filter(t => t.projectId === project.id)}
                isReadOnly={isReadOnly}
                onBack={() => {
                    setSelectedProjectId(null);
                    loadData(); // Reload to get fresh task counts
                }}
                onUpdateProject={(updatedProj) => {
                    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
                }}
            />
        );
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 p-4 md:p-8 animate-in fade-in duration-300">

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                <FolderKanban className="text-green-600 dark:text-green-400" />
                Project Planner
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage long-term projects and tasks.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* View Toggle */}
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                <button
                    onClick={() => setActiveTab('projects')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'projects' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <Briefcase size={16} /> Projects
                </button>
                <button
                    onClick={() => setActiveTab('tasks')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'tasks' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <Clock size={16} /> All Tasks
                </button>
                <button
                    onClick={() => setActiveTab('ideas')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'ideas' ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <Lightbulb size={16} /> Ideas
                </button>
                <button
                    onClick={() => setActiveTab('routines')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'routines' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <RotateCw size={16} /> Routines
                </button>
            </div>

            <div className="w-px h-8 bg-slate-300 dark:bg-slate-700 mx-1 hidden md:block"></div>

            <button
                onClick={() => setIsManageCategoriesOpen(true)}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg transition-colors shadow-sm hover:shadow"
            >
                <Settings size={16} /> <span className="hidden sm:inline">Categories</span>
            </button>

            {!isReadOnly && activeTab === 'projects' && (
                <button
                    onClick={() => setIsCreateProjectOpen(true)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm hover:shadow"
                >
                    <Plus size={16} /> New Project
                </button>
            )}
        </div>
      </div>

      {loading ? (
          <div className="flex-1 flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
      ) : activeTab === 'ideas' ? (
        <div className="flex flex-col flex-1 h-full min-h-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-900/10">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Lightbulb className="text-amber-500" /> Global Ideas & Notes
                </h2>
                <p className="text-sm text-slate-500 mt-1">Quick thoughts not yet assigned to projects or converted to tasks.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {ideas.filter(i => !i.projectId).length === 0 ? (
                    <div className="text-center text-slate-400 dark:text-slate-500 mt-10">
                        <Lightbulb size={40} className="mx-auto mb-3 opacity-20" />
                        <p>No global ideas found.</p>
                        <p className="text-sm">Use the Quick Add button to jot down ideas.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ideas.filter(i => !i.projectId).map(idea => (
                            <div key={idea.id} className="bg-amber-50 dark:bg-slate-800 border border-amber-100 dark:border-slate-700 p-4 rounded-xl shadow-sm flex flex-col group">
                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap flex-1">{idea.text}</p>
                                <div className="flex justify-between items-center mt-4 pt-3 border-t border-amber-200/50 dark:border-slate-700">
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {new Date(idea.createdAt).toLocaleDateString()}
                                    </span>
                                    <div className="flex gap-2">
                                        {!isReadOnly && (
                                            <>
                                                <button onClick={(e) => handleDeleteIdea(idea.id, e)} className="p-1.5 text-slate-400 hover:text-red-500 rounded bg-white dark:bg-slate-900 shadow-sm transition-colors" title="Delete Idea">
                                                    <Trash2 size={14} />
                                                </button>
                                                <button onClick={() => handleConvertIdeaToTask(idea)} className="px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded shadow-sm transition-colors flex items-center gap-1">
                                                    Convert to Task
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      ) : activeTab === 'routines' ? (
        <RoutineTasksView isReadOnly={isReadOnly} />
      ) : activeTab === 'projects' ? (

        <div className="flex flex-col flex-1 h-full min-h-0">
            {/* AI Insights Panel */}
            <AIInsightsPanel
                contextType="all_tasks"
                tasks={allTasks}
                isReadOnly={isReadOnly}
                onTaskUpdate={() => {
        // Prevent refresh scroll jump, assume components handle local state
    }}
            />

            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 shrink-0">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={projectSearchQuery}
                        onChange={(e) => setProjectSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 shadow-sm"
                    />
                </div>

                <div className="relative shrink-0">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select
                        value={selectedProjectCategory}
                        onChange={(e) => setSelectedProjectCategory(e.target.value)}
                        className="appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 shadow-sm text-sm cursor-pointer min-w-[180px]"
                    >
                        <option value="All">All Categories</option>
                        {projectCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Projects Grid */}
            <div className="flex-1 overflow-y-auto pb-8 pr-2 custom-scrollbar">
                {filteredProjects.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 space-y-4">
                        <FolderKanban size={48} className="opacity-20" />
                        <p>No projects found matching your criteria.</p>
                        {!isReadOnly && !projectSearchQuery && (
                            <button
                                onClick={() => setIsCreateProjectOpen(true)}
                                className="text-green-600 hover:underline"
                            >
                                Create your first project
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-8">
                        {(() => {
                            // Group projects by category
                            const groups = new Map<string, typeof filteredProjects>();
                            groups.set('uncategorized', []);
                            projectCategories.forEach(c => groups.set(c.id, []));

                            filteredProjects.forEach(project => {
                                if (project.categoryId && groups.has(project.categoryId)) {
                                    groups.get(project.categoryId)!.push(project);
                                } else {
                                    groups.get('uncategorized')!.push(project);
                                }
                            });

                            return Array.from(groups.entries()).map(([catId, catProjects]) => {
                                if (catProjects.length === 0) return null;
                                const category = projectCategories.find(c => c.id === catId);

                                return (
                                    <div key={catId} className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            {category ? (
                                                <>
                                                    <span className={`w-3 h-3 rounded-full border ${category.colorClass.split(' ')[0]} ${category.colorClass.split(' ')[2] || ''}`}></span>
                                                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{category.name}</h2>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="w-3 h-3 rounded-full border bg-slate-200 border-slate-300"></span>
                                                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Other Projects</h2>
                                                </>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">

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
                                            )}
                                            {catProjects.map(project => {
                                                const projectTasks = allTasks.filter(t => t.projectId === project.id);
                                                const completedTasks = projectTasks.filter(t => t.status === 'Completed').length;
                                                const totalTasks = projectTasks.length;
                                                const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

                                                return (
                                                <div
                                                    key={project.id}
                                                    onClick={() => {
                                                        setSelectedProjectId(project.id);
                                                        window.scrollTo(0, 0);
                                                    }}
                                                    className={`group flex flex-col bg-white dark:bg-slate-900 rounded-2xl border ${project.colorClass || 'border-slate-200 dark:border-slate-800'} shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden hover:-translate-y-1`}
                                                >
                                                    {/* Card Header with optional background color */}
                                                    <div className={`p-5 pb-4 ${project.colorClass ? (project.colorClass.replace('bg-', 'bg-').replace('border-', 'border-b-') + ' border-b') : 'border-b border-slate-100 dark:border-slate-800'}`}>
                                                        <div className="flex justify-between items-start gap-2 mb-2">
                                                            <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-2 leading-tight">
                                                                {project.name}
                                                            </h3>
                                                            {!isReadOnly && (
                                                                <button
                                                                    onClick={(e) => handleDeleteProject(project.id, e)}
                                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-white/50 dark:hover:bg-slate-800 rounded-md transition-all shrink-0"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getCategoryClass(project.categoryId)}`}>
                                                            {getCategoryName(project.categoryId)}
                                                        </span>
                                                    </div>

                                                    {/* Card Body */}
                                                    <div className="p-5 pt-4 flex-1 flex flex-col justify-between">
                                                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 mb-6 min-h-[60px]">
                                                            {project.description || <span className="italic opacity-50">No description provided.</span>}
                                                        </p>

                                                        {/* Progress Bar & Stats */}
                                                        <div className="space-y-3 mt-auto">
                                                            <div className="flex justify-between items-end text-sm">
                                                                <span className="font-medium text-slate-700 dark:text-slate-300">Progress</span>
                                                                <span className="font-bold text-slate-900 dark:text-white">{progress}%</span>
                                                            </div>
                                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                                                <div
                                                                    className={`h-2 rounded-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-green-400'}`}
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-500 pt-1">
                                                                <span>{totalTasks} Tasks Total</span>
                                                                <span>{completedTasks} Completed</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                )}
            </div>
        </div>

      ) : (
          <GlobalTasksView
            allTasks={allTasks}
            projects={projects}
            categories={categories}
            isReadOnly={isReadOnly}
            onTaskUpdate={() => {
        // Prevent refresh scroll jump, assume components handle local state
    }} // Reload everything if task changes
          />
      )}

      {/* Create Project Modal */}
      {isCreateProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <form onSubmit={handleCreateProject}>
                    <div className="px-6 py-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Create New Project</h2>
                        <button
                            type="button"
                            onClick={() => setIsCreateProjectOpen(false)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project Name *</label>
                            <input
                                type="text"
                                required
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                placeholder="e.g. End of Year Play"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                            <select
                                value={newProjectCategory}
                                onChange={(e) => setNewProjectCategory(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
                            >
                                <option value="">No Category</option>
                                {projectCategories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                            <textarea
                                value={newProjectDesc}
                                onChange={(e) => setNewProjectDesc(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 min-h-[100px] resize-y"
                                placeholder="Briefly describe the project goals..."
                            />
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsCreateProjectOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!newProjectName.trim()}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            Create Project
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      <ManageCategoriesModal
        isOpen={isManageCategoriesOpen}
        onClose={() => setIsManageCategoriesOpen(false)}
        isReadOnly={isReadOnly}
      />

      <TaskEditModal
          isOpen={isTaskModalOpen}
          onClose={() => { setIsTaskModalOpen(false); setConvertingIdea(null); }}
          task={convertingIdea ? { id: `task_${Date.now()}`, projectId: convertingIdea.projectId || '', title: convertingIdea.text.split('\n')[0].substring(0, 50), description: convertingIdea.text, status: 'Uncompleted', priority: 'Medium' } : addingGeneralTaskCategory ? { id: `task_${Date.now()}`, projectId: '', categoryId: addingGeneralTaskCategory, title: '', status: 'Uncompleted', priority: 'Medium' } as Task : null} projects={projects}
          categories={categories}
          onSave={handleSaveConvertedTask}
      />

    </div>
  );
};

export default ProjectPlanner;