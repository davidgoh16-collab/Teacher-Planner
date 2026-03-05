import React, { useState, useEffect } from 'react';
import { Project, Category, Task } from '../types';
import { fetchProjects, fetchCategories, fetchTasks, saveProject, deleteProject } from '../services/projectService';
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
  X
} from 'lucide-react';
import ProjectView from './ProjectView';
import GlobalTasksView from './GlobalTasksView';
import AIInsightsPanel from './AIInsightsPanel';

interface ProjectPlannerProps {
  isReadOnly: boolean;
}

const ProjectPlanner: React.FC<ProjectPlannerProps> = ({ isReadOnly }) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'tasks'>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedProjects, fetchedCategories, fetchedTasks] = await Promise.all([
        fetchProjects(),
        fetchCategories(),
        fetchTasks()
      ]);
      setProjects(fetchedProjects);
      setCategories(fetchedCategories);
      setAllTasks(fetchedTasks);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'projects' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <Briefcase size={16} /> Projects
                </button>
                <button
                    onClick={() => setActiveTab('tasks')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'tasks' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <Clock size={16} /> All Tasks
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
      ) : activeTab === 'projects' ? (

        <div className="flex flex-col flex-1 h-full min-h-0">
            {/* AI Insights Panel */}
            <AIInsightsPanel
                contextType="all_tasks"
                tasks={allTasks}
                isReadOnly={isReadOnly}
                onTaskUpdate={() => loadData()}
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
            onTaskUpdate={() => loadData()} // Reload everything if task changes
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

    </div>
  );
};

export default ProjectPlanner;