import React, { useState, useEffect } from 'react';
import { Project, Category, Task } from '../types';
import { fetchProjects, fetchCategories, fetchTasks, saveProject, deleteProject, fetchIdeas, deleteIdea, saveTask } from '../services/projectService';
import ManageCategoriesModal from './ManageCategoriesModal';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  RotateCw,
  RotateCcw,
  GripVertical,
  Edit2,
  CheckCircle2,
  Circle,
  Sparkles,
  Wand2,
  Share2
} from 'lucide-react';
import ProjectView from './ProjectView';
import GlobalTasksView from './GlobalTasksView';
import AIInsightsPanel from './AIInsightsPanel';
import VibeProjectModal from './VibeProjectModal';
import TaskEditModal from './TaskEditModal';
import TaskCardModal from './TaskCardModal';
import RoutineTasksView from './RoutineTasksView';
import { Idea } from '../types';
import { getContrastTextColor } from '../utils/colorUtils';
import { handleTaskRecurrence } from '../utils/taskUtils';

interface ProjectPlannerProps {
  isReadOnly: boolean;
  globalTasks: Task[];
  externalSelectedProjectId?: string | null;
  onClearExternalProject?: () => void;
  onTaskUpdate?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskAdd?: (task: Task) => void;
  todaysLessons?: { period: string; subject: string; hasPlan: boolean }[];
  upcomingKeyDates?: { title: string; dateStr: string }[];
  onShareProject?: (projectId: string, projectName: string) => void;
}

// Sortable wrapper for a draggable project card. Exposes drag-handle listeners
// to its children so only the grip handle initiates a drag (the rest of the card
// stays clickable to open the project).
const SortableProjectCard: React.FC<{ id: string; children: (handleProps: Record<string, any>) => React.ReactNode }> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners || {})}
    </div>
  );
};

// Droppable wrapper around a category group's grid so a card can be dropped into
// the group even if it currently has no cards under the cursor.
const DroppableGroup: React.FC<{ id: string; className?: string; children: React.ReactNode }> = ({ id, className, children }) => {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className={className}>{children}</div>;
};

const ProjectPlanner: React.FC<ProjectPlannerProps> = ({ isReadOnly, globalTasks, externalSelectedProjectId, onClearExternalProject, onTaskUpdate, onTaskDelete, onTaskAdd, todaysLessons, upcomingKeyDates, onShareProject }) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'tasks' | 'ideas' | 'routines'>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>(globalTasks);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync with global state when it changes
  useEffect(() => {
    setAllTasks(globalTasks);
  }, [globalTasks]);

  const [convertingIdea, setConvertingIdea] = useState<Idea | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Search & Filter state for Projects List
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [selectedProjectCategory, setSelectedProjectCategory] = useState<string>('All');

  // Modals
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isVibeOpen, setIsVibeOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
     if (externalSelectedProjectId) {
         setSelectedProjectId(externalSelectedProjectId);
         setActiveTab('projects');
         if (onClearExternalProject) onClearExternalProject();
     }
  }, [externalSelectedProjectId, onClearExternalProject]);

  // New Project Form State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState('');
  const [addingGeneralTaskCategory, setAddingGeneralTaskCategory] = useState<string | null>(null);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardTask, setCardTask] = useState<Task | null>(null);

  const openCardModal = (task: Task, e: React.MouseEvent) => {
      e.stopPropagation();
      setCardTask(task);
      setIsCardModalOpen(true);
  };

  const openEditModal = (task: Task) => {
      setEditingTask(task);
      setIsTaskModalOpen(true);
  };

  const handleToggleTaskStatus = async (task: Task) => {
    if (isReadOnly) return;
    const nextStatus: Task['status'] = task.status === 'Completed' ? 'Uncompleted' : task.status === 'Uncompleted' ? 'In Progress' : 'Completed';
    let updated = { ...task, status: nextStatus, completedAt: nextStatus === 'Completed' ? Date.now() : undefined };

    if (nextStatus === 'Completed' && updated.recurrenceType) {
        // Reset and schedule next occurrence
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let nextDate = new Date(now);

        if (updated.recurrenceType === 'daily') {
            nextDate.setDate(nextDate.getDate() + 1);
        } else if (updated.recurrenceType === 'weekly' && updated.recurrenceDays && updated.recurrenceDays.length > 0) {
            let minDays = 7;
            const todayDay = now.getDay();
            for (const day of updated.recurrenceDays) {
                let diff = day - todayDay;
                if (diff <= 0) diff += 7; // Ensure it's in the future
                if (diff < minDays) minDays = diff;
            }
            nextDate.setDate(nextDate.getDate() + minDays);
        }

        const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const newDateStr = formatDate(nextDate);

        // If it had a scheduled date and deadline date, maintain the gap
        let newScheduled = updated.scheduledDateStr;
        let newDeadline = updated.deadlineDateStr;

        if (updated.scheduledDateStr && updated.deadlineDateStr) {
            const gap = new Date(updated.deadlineDateStr).getTime() - new Date(updated.scheduledDateStr).getTime();
            newScheduled = newDateStr;
            newDeadline = formatDate(new Date(nextDate.getTime() + gap));
        } else if (updated.scheduledDateStr) {
            newScheduled = newDateStr;
        } else if (updated.deadlineDateStr) {
            newDeadline = newDateStr;
        }

        updated = {
            ...updated,
            status: 'Uncompleted',
            completedAt: undefined,
            scheduledDateStr: newScheduled,
            deadlineDateStr: newDeadline,
        };
    }

    setAllTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    if (cardTask?.id === task.id) {
        setCardTask(updated);
    }
    if (onTaskUpdate) onTaskUpdate(updated);
    try {
        await saveTask(updated);
    } catch (e) {
        console.error(e);
        setAllTasks(prev => prev.map(t => t.id === task.id ? task : t)); // revert
        if (cardTask?.id === task.id) {
            setCardTask(task);
        }
        if (onTaskUpdate) onTaskUpdate(task);
    }
  };

  const handleToggleProjectComplete = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;
    const nextCompleted = !project.completed;
    const updated: Project = {
      ...project,
      completed: nextCompleted,
      completedAt: nextCompleted ? Date.now() : undefined,
    };
    setProjects(prev => prev.map(p => p.id === project.id ? updated : p));
    try {
      await saveProject(updated);
    } catch (err) {
      console.error(err);
      setProjects(prev => prev.map(p => p.id === project.id ? project : p)); // revert
    }
  };

  // Drag-to-reorder (and move between categories) for active project cards.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleProjectDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (isReadOnly || !over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // The droppable can be a project card (overId === project id) or an empty
    // category container (overId === `container:<catKey>`).
    const containerPrefix = 'container:';
    const overContainer = overId.startsWith(containerPrefix);
    const destCatKey = overContainer
      ? overId.slice(containerPrefix.length)
      : (projects.find(p => p.id === overId)?.categoryId || 'uncategorized');
    if (!destCatKey) return;

    const draggedProject = projects.find(p => p.id === activeId);
    if (!draggedProject) return;

    const destCategoryId = destCatKey === 'uncategorized' ? undefined : destCatKey;

    // Build the active (non-completed) ordering, applying category reassignment.
    const activeProjects = projects.filter(p => !p.completed);
    const reassigned = activeProjects.map(p =>
      p.id === activeId ? { ...p, categoryId: destCategoryId } : p
    );

    const oldIndex = reassigned.findIndex(p => p.id === activeId);
    const newIndex = overContainer
      ? reassigned.length - 1
      : reassigned.findIndex(p => p.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(reassigned, oldIndex, newIndex);

    // Reassign sequential order values across all active projects.
    const orderMap = new Map<string, number>();
    reordered.forEach((p, i) => orderMap.set(p.id, i));

    const prevProjects = projects;
    const updatedProjects = projects.map(p => {
      if (orderMap.has(p.id)) {
        const next: Project = { ...p, order: orderMap.get(p.id)! };
        if (p.id === activeId) next.categoryId = destCategoryId;
        return next;
      }
      return p;
    });
    // Keep array sorted by order so render reflects the new positions immediately.
    updatedProjects.sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));
    setProjects(updatedProjects);

    try {
      const changed = updatedProjects.filter(p => {
        const before = prevProjects.find(o => o.id === p.id);
        return before && (before.order !== p.order || before.categoryId !== p.categoryId);
      });
      await Promise.all(changed.map(p => saveProject(p)));
    } catch (err) {
      console.error(err);
      setProjects(prevProjects); // revert
    }
  };

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

      // Auto-create missing "General Tasks" projects for existing categories
      if (!isReadOnly) {
        let hasNewProjects = false;
        const projectCategories = fetchedCategories.filter(c => c.type === 'project');
        for (const cat of projectCategories) {
          const expectedName = `${cat.name} General Tasks`;
          const hasGeneralProject = fetchedProjects.some(p => p.categoryId === cat.id && p.name === expectedName);
          if (!hasGeneralProject) {
            const newGeneralProject: Project = {
              id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: expectedName,
              description: `General tasks for the ${cat.name} category.`,
              categoryId: cat.id,
              colorClass: cat.colorClass,
              links: [],
              tasks: [],
              createdAt: Date.now()
            };
            await saveProject(newGeneralProject);
            fetchedProjects.push(newGeneralProject);
            hasNewProjects = true;
          }
        }

        // Also ensure existing general task projects have the correct color sync with their category
        let hasUpdatedProjects = false;
        for (const p of fetchedProjects) {
          if (p.name.endsWith('General Tasks') && p.categoryId) {
            const cat = fetchedCategories.find(c => c.id === p.categoryId);
            if (cat && p.colorClass !== cat.colorClass) {
              const updatedProject = { ...p, colorClass: cat.colorClass };
              await saveProject(updatedProject);
              Object.assign(p, updatedProject);
              hasUpdatedProjects = true;
            }
          }
        }

        // Migrate any orphaned general tasks (tasks with categoryId but no projectId) to the actual General Tasks project
        let hasMigratedTasks = false;
        const updatedTasks = [...fetchedTasks];
        for (let i = 0; i < updatedTasks.length; i++) {
          const task = updatedTasks[i];
          if (task.categoryId && (!task.projectId || task.projectId === '')) {
            const cat = fetchedCategories.find(c => c.id === task.categoryId);
            if (cat && cat.type === 'project') {
              const expectedName = `${cat.name} General Tasks`;
              const generalProject = fetchedProjects.find(p => p.categoryId === cat.id && p.name === expectedName);
              if (generalProject) {
                const updatedTask = { ...task, projectId: generalProject.id };
                await saveTask(updatedTask);
                updatedTasks[i] = updatedTask;
                hasMigratedTasks = true;
              }
            }
          }
        }

        if (hasNewProjects || hasUpdatedProjects) {
          setProjects([...fetchedProjects]);
        } else {
          setProjects(fetchedProjects);
        }

        if (hasMigratedTasks) {
          setAllTasks([...updatedTasks]);
        } else {
          setAllTasks(fetchedTasks);
        }
      } else {
        setProjects(fetchedProjects);
        setAllTasks(fetchedTasks);
      }

      setCategories(fetchedCategories);
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

  const handleSaveConvertedTask = async (task: Task) => {
      if (isReadOnly) return;
      try {
          await saveTask(task);
          if (editingTask) {
              setAllTasks(prev => prev.map(t => t.id === task.id ? task : t));
              if (onTaskUpdate) onTaskUpdate(task);
          } else {
              if (convertingIdea) await deleteIdea(convertingIdea.id);
              setAllTasks(prev => [task, ...prev]);
              if (onTaskAdd) onTaskAdd(task);
              if (convertingIdea) setIdeas(prev => prev.filter(i => i.id !== convertingIdea.id));
          }
      } catch (e) {
          console.error("Failed to save task", e);
      } finally {
          setIsTaskModalOpen(false);
          setConvertingIdea(null);
          setAddingGeneralTaskCategory(null);
          setEditingTask(null);
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
                allProjects={projects}
                allCategories={categories}
                allTasks={allTasks.filter(t => t.projectId === project.id)}
                isReadOnly={isReadOnly}
                onBack={() => {
                    setSelectedProjectId(null);
                    loadData(); // Reload to get fresh task counts
                }}
                onTaskDeleted={(taskId) => {
                    setAllTasks(prev => prev.filter(t => t.id !== taskId));
                    if (onTaskDelete) onTaskDelete(taskId);
                }}
                onTaskUpdated={(updatedTask) => {
                    setAllTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                    if (onTaskUpdate) onTaskUpdate(updatedTask);
                }}
                onTaskAdded={(newTask) => {
                    setAllTasks(prev => [newTask, ...prev]);
                    if (onTaskAdd) onTaskAdd(newTask);
                }}
                onUpdateProject={(updatedProj) => {
                    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
                }}
            />
        );
    }
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-8 animate-in fade-in duration-300">

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                <FolderKanban className="text-primary-600 dark:text-primary-400" />
                Project Planner
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage long-term projects and tasks.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {/* View Toggle */}
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg shrink-0 w-full sm:w-auto overflow-x-auto">
                <button
                    onClick={() => setActiveTab('projects')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none whitespace-nowrap ${activeTab === 'projects' ? 'bg-white dark:bg-slate-700 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <Briefcase size={16} className="shrink-0" /> Projects
                </button>
                <button
                    onClick={() => setActiveTab('tasks')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none whitespace-nowrap ${activeTab === 'tasks' ? 'bg-white dark:bg-slate-700 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <Clock size={16} className="shrink-0" /> Tasks
                </button>
                <button
                    onClick={() => setActiveTab('ideas')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none whitespace-nowrap ${activeTab === 'ideas' ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <Lightbulb size={16} className="shrink-0" /> Ideas
                </button>
                <button
                    onClick={() => setActiveTab('routines')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none whitespace-nowrap ${activeTab === 'routines' ? 'bg-white dark:bg-slate-700 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <RotateCw size={16} className="shrink-0" /> Routines
                </button>
            </div>

            <div className="w-px h-8 bg-slate-300 dark:bg-slate-700 mx-1 hidden md:block"></div>

            <button
                onClick={() => setIsManageCategoriesOpen(true)}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg transition-colors shadow-sm hover:shadow"
            >
                <Settings size={16} /> <span className="hidden sm:inline">Categories</span>
            </button>

            {activeTab === 'projects' && !isReadOnly && (
                <button
                    onClick={() => setShowInsights(true)}
                    disabled={allTasks.length === 0}
                    className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title={allTasks.length === 0 ? "Add tasks to generate insights" : "Generate AI insights"}
                >
                    <Sparkles size={16} /> <span className="hidden sm:inline">Generate Insights</span>
                </button>
            )}

            {activeTab === 'projects' && !isReadOnly && (
                <button
                    onClick={() => setIsVibeOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm hover:shadow"
                >
                    <Wand2 size={16} /> Vibe Project
                </button>
            )}

            {!isReadOnly && activeTab === 'projects' && (
                <button
                    onClick={() => setIsCreateProjectOpen(true)}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm hover:shadow"
                >
                    <Plus size={16} /> New Project
                </button>
            )}

            {activeTab === 'projects' && (
                <>
                    <div className="w-px h-8 bg-slate-300 dark:bg-slate-700 mx-1 hidden lg:block"></div>
                    <div className="relative shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={projectSearchQuery}
                            onChange={(e) => setProjectSearchQuery(e.target.value)}
                            className="w-40 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 shadow-sm"
                        />
                    </div>
                    <div className="relative shrink-0">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <select
                            value={selectedProjectCategory}
                            onChange={(e) => setSelectedProjectCategory(e.target.value)}
                            className="appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 shadow-sm cursor-pointer"
                        >
                            <option value="All">All Categories</option>
                            {projectCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                </>
            )}
        </div>
      </div>

      {loading ? (
          <div className="flex-1 flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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

                {!isReadOnly && (
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        const input = (e.target as any).ideaInput;
                        const text = input.value.trim();
                        if (!text) return;

                        const newIdea = {
                            id: `idea_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            text: text,
                            projectId: undefined,
                            createdAt: Date.now()
                        };

                        try {
                            const { saveIdea } = await import('../services/projectService');
                            await saveIdea(newIdea);
                            setIdeas(prev => [newIdea, ...prev]);
                            input.value = '';
                        } catch(err) {
                            console.error("Failed to add idea", err);
                        }
                    }} className="mb-6 flex gap-2 max-w-2xl mx-auto">
                        <input
                            name="ideaInput"
                            type="text"
                            placeholder="Jot down a global idea..."
                            className="flex-1 bg-white dark:bg-slate-950 border border-amber-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                            autoComplete="off"
                        />
                        <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shadow-sm">
                            Add Idea
                        </button>
                    </form>
                )}
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
                                                <button onClick={() => handleConvertIdeaToTask(idea)} className="px-2 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded shadow-sm transition-colors flex items-center gap-1">
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
            {/* AI Insights Panel — only shown after the user clicks "Generate Insights" */}
            {showInsights && (
                <AIInsightsPanel
                    contextType="all_tasks"
                    tasks={allTasks}
                    isReadOnly={isReadOnly}
                    onClose={() => setShowInsights(false)}
                    onTaskUpdate={() => {
                        // Prevent refresh scroll jump, assume components handle local state
                    }}
                />
            )}

            {/* Projects Grid */}
            <div className="flex-1 overflow-y-auto pb-8 pr-2 custom-scrollbar">
                {filteredProjects.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 space-y-4">
                        <FolderKanban size={48} className="opacity-20" />
                        <p>No projects found matching your criteria.</p>
                        {!isReadOnly && !projectSearchQuery && (
                            <button
                                onClick={() => setIsCreateProjectOpen(true)}
                                className="text-primary-600 hover:underline"
                            >
                                Create your first project
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-8">
                        {(() => {

                            // Calculate progress for all filtered projects first
                            const projectsWithProgress = filteredProjects.map(project => {
                                const projectTasks = allTasks.filter(t => t.projectId === project.id);
                                const completedTasks = projectTasks.filter(t => t.status === 'Completed').length;
                                const totalTasks = projectTasks.length;
                                const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
                                return { ...project, _progress: progress, _totalTasks: totalTasks, _completedTasks: completedTasks, _projectTasks: projectTasks };
                            });

                            // Keep the manual order from the service; completion is now
                            // an explicit per-project flag, not derived from progress.
                            const activeProjects = projectsWithProgress.filter(p => !p.completed);
                            const completedProjects = projectsWithProgress.filter(p => p.completed);

                            const renderProjectCard = (project: any, dragHandleProps?: Record<string, any>) => {
                                const topTasks = project._projectTasks.filter(t => t.status !== 'Completed').sort((a, b) => {
                                    const pMap: any = { High: 3, Medium: 2, Low: 1 };
                                    const pDiff = (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
                                    if (pDiff !== 0) return pDiff;
                                    const dateA = a.deadlineDateStr || a.scheduledDateStr || '9999-12-31';
                                    const dateB = b.deadlineDateStr || b.scheduledDateStr || '9999-12-31';
                                    return new Date(dateA).getTime() - new Date(dateB).getTime();
                                }).slice(0, 5);

                                return (
                                <div
                                    key={project.id}
                                    onClick={() => {
                                        setSelectedProjectId(project.id);
                                        window.scrollTo(0, 0);
                                    }}
                                    className={`group flex flex-col bg-white dark:bg-slate-900 rounded-2xl border ${project.colorClass || 'border-slate-200 dark:border-slate-800'} shadow-sm hover:shadow-sm transition-all duration-200 cursor-pointer overflow-hidden hover:-translate-y-1`}
                                >
                                    {/* Card Header with optional background color */}
                                    <div className={`p-5 pb-4 ${project.colorClass ? (project.colorClass.replace('bg-', 'bg-').replace('border-', 'border-b-') + ' border-b') : 'border-b border-slate-100 dark:border-slate-800'}`}>
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                            <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                                {!isReadOnly && dragHandleProps && (
                                                    <button
                                                        {...dragHandleProps}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="mt-0.5 shrink-0 p-0.5 -ml-1 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
                                                        title="Drag to reorder"
                                                        aria-label="Drag to reorder project"
                                                    >
                                                        <GripVertical size={16} />
                                                    </button>
                                                )}
                                                <h3 className={`font-bold text-lg line-clamp-2 leading-tight ${project.colorClass ? getContrastTextColor(project.colorClass) : 'text-slate-900 dark:text-white'}`}>
                                                    {project.name}
                                                </h3>
                                            </div>
                                            {!isReadOnly && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {onShareProject && (
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); onShareProject(project.id, project.name); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-primary-600 hover:bg-white/50 dark:hover:bg-slate-800 rounded-md transition-all"
                                                        title="Share project"
                                                      >
                                                        <Share2 size={16} />
                                                      </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => handleToggleProjectComplete(project, e)}
                                                        className={`p-1.5 rounded-md transition-all hover:bg-white/50 dark:hover:bg-slate-800 ${project.completed ? 'text-primary-500 hover:text-slate-400' : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-primary-500'}`}
                                                        title={project.completed ? 'Reopen project' : 'Mark project complete'}
                                                    >
                                                        {project.completed ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteProject(project.id, e)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-white/50 dark:hover:bg-slate-800 rounded-md transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getCategoryClass(project.categoryId)} ${getContrastTextColor(getCategoryClass(project.categoryId))}`}>
                                            {getCategoryName(project.categoryId)}
                                        </span>
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <ul className="space-y-2 mb-4 flex-1">
                                            {topTasks.length === 0 ? (
                                                <li className="text-xs text-slate-400 italic mt-2">No active tasks.</li>
                                            ) : topTasks.map(task => (
                                                <li key={task.id} onClick={(e) => openCardModal(task, e)} className="cursor-pointer text-sm text-slate-600 dark:text-slate-400 flex flex-col gap-1 border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800/50 group/task hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                                                    <div className="flex items-start gap-2">
                                                        <button onClick={(e) => { e.stopPropagation(); handleToggleTaskStatus(task); }} disabled={isReadOnly} className="mt-0.5 shrink-0 hover:scale-110">
                                                            {task.status === 'Completed' ? <CheckCircle2 size={14} className="text-primary-500" /> : task.status === 'In Progress' ? <Clock size={14} className="text-amber-500" /> : <Circle size={14} className="text-slate-300 dark:text-slate-600 hover:text-slate-500" />}
                                                        </button>
                                                        <span className={`flex-1 truncate line-clamp-2 whitespace-normal break-words leading-tight ${task.status === 'Completed' ? 'line-through text-slate-400' : task.status === 'In Progress' ? 'text-amber-700 dark:text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>{task.title}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>

                                        {/* Progress Bar & Stats */}
                                        <div className="space-y-3 mt-auto">
                                            <div className="flex justify-between items-end text-sm">
                                                <span className="font-medium text-slate-700 dark:text-slate-300">Progress</span>
                                                <span className="font-bold text-slate-900 dark:text-white">{project._progress}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={`h-2 rounded-full transition-all duration-500 ${project._progress === 100 ? 'bg-primary-500' : 'bg-primary-400'}`}
                                                    style={{ width: `${project._progress}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-500 pt-1">
                                                <span>{project._totalTasks} Tasks Total</span>
                                                <span>{project._completedTasks} Completed</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                );
                            };

                            const renderGroups = (projectsToRender: typeof projectsWithProgress, draggable = false) => {
                                const groups = new Map<string, typeof projectsToRender>();
                                groups.set('uncategorized', []);
                                projectCategories.forEach(c => groups.set(c.id, []));

                                projectsToRender.forEach(project => {
                                    if (project.categoryId && groups.has(project.categoryId)) {
                                        groups.get(project.categoryId)!.push(project);
                                    } else {
                                        groups.get('uncategorized')!.push(project);
                                    }
                                });

                                return Array.from(groups.entries()).map(([catId, catProjects]) => {
                                    if (catProjects.length === 0) return null;
                                    const category = projectCategories.find(c => c.id === catId);
                                    const gridClass = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6";

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

                                            {draggable && !isReadOnly ? (
                                                <DroppableGroup id={`container:${catId}`} className={gridClass}>
                                                    <SortableContext items={catProjects.map(p => p.id)} strategy={rectSortingStrategy}>
                                                        {catProjects.map(project => (
                                                            <SortableProjectCard key={project.id} id={project.id}>
                                                                {(handleProps) => renderProjectCard(project, handleProps)}
                                                            </SortableProjectCard>
                                                        ))}
                                                    </SortableContext>
                                                </DroppableGroup>
                                            ) : (
                                                <div className={gridClass}>
                                                    {catProjects.map(project => renderProjectCard(project))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                });
                            };

                            return (
                                <>
                                    <DndContext sensors={dndSensors} collisionDetection={closestCorners} onDragEnd={handleProjectDragEnd}>
                                        {renderGroups(activeProjects, true)}
                                    </DndContext>
                                    {completedProjects.length > 0 && (
                                        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
                                            <details className="group">
                                                <summary className="flex items-center gap-2 font-semibold text-slate-500 cursor-pointer list-none hover:text-slate-700 transition-colors">
                                                    <span className="flex-1 text-lg flex items-center gap-2"><CheckCircle2 size={20} className="text-primary-500" /> Completed Projects ({completedProjects.length})</span>
                                                    <span className="transform group-open:rotate-180 transition-transform"><MoreVertical size={16} className="rotate-90"/></span>
                                                </summary>
                                                <div className="mt-6 opacity-60 hover:opacity-100 transition-opacity">
                                                    {renderGroups(completedProjects)}
                                                </div>
                                            </details>
                                        </div>
                                    )}
                                </>
                            );
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
            todaysLessons={todaysLessons}
            upcomingKeyDates={upcomingKeyDates}
            onTaskDeleted={(taskId) => {
                setAllTasks(prev => prev.filter(t => t.id !== taskId));
                if (onTaskDelete) onTaskDelete(taskId);
            }}
            onTaskUpdated={(updatedTask) => {
                setAllTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                if (onTaskUpdate) onTaskUpdate(updatedTask);
            }}
          />
      )}

      {/* Create Project Modal */}
      {isCreateProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
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
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                placeholder="e.g. End of Year Play"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                            <select
                                value={newProjectCategory}
                                onChange={(e) => setNewProjectCategory(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
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
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 min-h-[100px] resize-y"
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
                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
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
        onCategoriesUpdated={() => loadData()}
      />

      <VibeProjectModal
        isOpen={isVibeOpen}
        onClose={() => setIsVibeOpen(false)}
        categories={categories}
        isReadOnly={isReadOnly}
        onCreated={(project, tasks, newCategory) => {
          if (newCategory) setCategories(prev => [...prev, newCategory]);
          setProjects(prev => [project, ...prev]);
          setAllTasks(prev => [...tasks, ...prev]);
          tasks.forEach(t => { if (onTaskAdd) onTaskAdd(t); });
        }}
      />

      <TaskEditModal
          isOpen={isTaskModalOpen}
          onClose={() => { setIsTaskModalOpen(false); setConvertingIdea(null); setEditingTask(null); }}
          task={editingTask ? editingTask : convertingIdea ? { id: `task_${Date.now()}`, projectId: convertingIdea.projectId || '', title: convertingIdea.text.split('\n')[0].substring(0, 50), description: convertingIdea.text, status: 'Uncompleted', priority: 'Medium' } : addingGeneralTaskCategory ? { id: `task_${Date.now()}`, projectId: '', categoryId: addingGeneralTaskCategory, title: '', status: 'Uncompleted', priority: 'Medium' } as Task : null} projects={projects}
          categories={categories}
          onSave={handleSaveConvertedTask}
      />

      <TaskCardModal
          isOpen={isCardModalOpen}
          onClose={() => { setIsCardModalOpen(false); setCardTask(null); }}
          task={cardTask}
          projects={projects}
          categories={categories}
          isReadOnly={isReadOnly}
          onEdit={openEditModal}
          onTaskStatusChange={handleToggleTaskStatus}
      />

    </div>
  );
};

export default ProjectPlanner;