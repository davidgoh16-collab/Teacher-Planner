
import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration, Chat } from "@google/genai";
import { auth } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { 
  PERIOD_LABELS, 
  DAYS 
} from './constants';
import { usePlannerData } from './src/context/PlannerContext';
import SettingsModal from './components/SettingsModal';
import { Settings } from 'lucide-react';
import { INITIAL_COLLEAGUES } from './src/data/initialColleagues';
import { 
  LessonPlan, 
  WeekData, 
  WeeklyTimetable
} from './types';
import { 
  generateWeeksForTerm, 
  toISODate, 
  addDays, 
  formatDate,
  getMonday
} from './utils/dateUtils';
import { getContrastTextColor, getEntryStyle, getEntryClassName } from './utils/colorUtils';
import LessonModal from './components/LessonModal';
import TaskEditModal from './components/TaskEditModal';
import ChatLauncher from './components/layout/ChatLauncher';
import AppShell from './components/layout/AppShell';
import HomePage from './components/HomePage';
import { useChatConversations } from './hooks/useChatConversations';
import LiveAssistant from './components/LiveAssistant';
import TaskCardModal from './components/TaskCardModal';
import MeetingPlanner from './components/MeetingPlanner';
import LoginPage from './components/LoginPage';
import ProjectPlanner from './components/ProjectPlanner';
import AppsHub from './components/AppsHub';
import GlobalSearch from './components/GlobalSearch';
import KeyDatesView from './components/KeyDatesView';
import { fetchLessonPlans, saveLessonPlan, deleteLessonPlan } from './services/lessonService';
import { fetchTasks, saveTask, fetchProjects, saveProject, fetchCategories, saveIdea, fetchIdeas, fetchRoutineTasks, saveRoutineTask, fetchKeyDates, saveKeyDate, deleteKeyDate } from './services/projectService';
import { fetchApps, fetchAppCategories, saveApp, deleteApp } from './services/appService';
import { TEXT_MODEL } from './services/aiService';
import { Task, Project, Category, ChatMessage, Idea, RoutineTask, AppItem, AppCategory, KeyDate, AppTab } from './types';
import QuickAddModal from './components/QuickAddModal';
import { 
  ChevronDown, 
  Plus,
  Calendar, 
  CalendarDays,
  BookOpen, 
  CheckCircle2, 
  Circle,
  Link as LinkIcon, 
  ChevronLeft, 
  ChevronRight,
  Download,
  Moon,
  Sun,
  Monitor,
  Users,
  WifiOff,
  X,
  LogOut,
  Loader2,
  Lock,
  Filter,
  Clock
} from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

// The specific user allowed to edit the planner
const ADMIN_UID = 'oleZncmmoyNerACQDErqtfMcNYS2';

const App: React.FC = () => {
  // --- Planner Context ---
  const { academicYears, selectedAcademicYearId, setSelectedAcademicYearId, terms, timetableWeek1, timetableWeek2, isPlannerDataLoading } = usePlannerData();

  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- State ---
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [hasInitializedState, setHasInitializedState] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('eduPlan_theme');
    return (saved as Theme) || 'system';
  });
  
  // Filter State
  const [viewFilter, setViewFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<AppTab>('home');

  // Global Tasks & Projects
  const [globalTasks, setGlobalTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Routine Tasks
  const [routineTasks, setRoutineTasks] = useState<RoutineTask[]>([]);

  // Other Global Data for AI Context
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [apps, setApps] = useState<AppItem[]>([]);
  const [appCategories, setAppCategories] = useState<AppCategory[]>([]);
  const [keyDates, setKeyDates] = useState<KeyDate[]>([]);

  // Lesson Plans: Keyed by "dateStr_periodLabel" -> LessonPlan object
  const [lessonPlans, setLessonPlans] = useState<Record<string, LessonPlan>>({});
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLessonKey, setEditingLessonKey] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState<string>('');

  // Task Edit/Card Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardTask, setCardTask] = useState<Task | null>(null);
  
  // Calendar Modal State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Quick Add Modal State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Global Search selection handler
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  // Conversation history lives here (single instance) so the Home chat and the
  // floating launcher share one continuous conversation.
  const chatConv = useChatConversations({ messages: chatMessages, onSetMessages: setChatMessages });
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStatusText, setLiveStatusText] = useState('');
  const [expandedRoutineDays, setExpandedRoutineDays] = useState<Record<string, boolean>>({});
  const [expandedActiveDays, setExpandedActiveDays] = useState<Record<string, boolean>>({});

  // AI Action History for Undo
  const [aiActionHistory, setAiActionHistory] = useState<Array<{ type: string, previousState: any }>>([]);

  // Pending AI actions awaiting user confirmation before they mutate the planner.
  const [pendingActions, setPendingActions] = useState<{ calls: any[]; summary: string } | null>(null);

  // --- Initialize state after context load ---
  useEffect(() => {
    if (!isPlannerDataLoading && terms.length > 0 && !hasInitializedState) {
      const now = new Date();

      // 1. Find the current or upcoming term
      let term = terms.find(t => now >= t.startDate && now <= t.endDate);

      if (!term) {
        term = terms.find(t => t.startDate > now);
      }

      if (!term) {
        if (terms.length > 0 && now > terms[terms.length - 1].endDate) {
          term = terms[terms.length - 1];
        } else {
          term = terms[0];
        }
      }

      const weeks = term ? generateWeeksForTerm(term) : [];
      let weekIndex = 0;

      const foundIndex = weeks.findIndex(w => {
        const weekStart = w.startDate;
        const weekEnd = addDays(weekStart, 7);
        return now >= weekStart && now < weekEnd;
      });

      if (foundIndex !== -1) {
        weekIndex = foundIndex;
      } else {
        const nextIndex = weeks.findIndex(w => w.startDate > now);
        if (nextIndex !== -1) {
          weekIndex = nextIndex;
        } else if (term && now > term.endDate) {
          weekIndex = Math.max(0, weeks.length - 1);
        }
      }

      setSelectedTermId(term?.id || '');
      setSelectedWeekIndex(weekIndex);
      setHasInitializedState(true);
    }
  }, [isPlannerDataLoading, terms, hasInitializedState]);

  // --- Derived Data ---
  const currentTerm = terms.find(t => t.id === selectedTermId) || terms[0];
  const weeksInTerm = useMemo(() => currentTerm ? generateWeeksForTerm(currentTerm) : [], [currentTerm]);
  
  const isAdmin = user?.uid === ADMIN_UID;
  const isReadOnly = !isAdmin;

  // Extract all unique subjects for the filter dropdown
  const uniqueSubjects = useMemo(() => {
    const subjects = new Set<string>();
    [timetableWeek1, timetableWeek2].forEach(tt => {
      Object.values(tt).forEach(daySchedule => {
        Object.values(daySchedule).forEach(entry => {
          if (entry?.subject) subjects.add(entry.subject);
        });
      });
    });
    return Array.from(subjects).sort();
  }, [timetableWeek1, timetableWeek2]);
  
  // Ensure selected week index is valid when term changes
  useEffect(() => {
    if (selectedWeekIndex >= weeksInTerm.length && weeksInTerm.length > 0) {
      setSelectedWeekIndex(0);
    }
  }, [selectedTermId, weeksInTerm.length, selectedWeekIndex]);

  const currentWeekData: WeekData | undefined = weeksInTerm[selectedWeekIndex];

  // Today's lessons (with plan status) for the proactive briefing panel.
  const todaysLessons = useMemo(() => {
    const todayISO = new Date().toISOString().split('T')[0];
    const todayDow = new Date().getDay(); // 0=Sun..6=Sat
    if (todayDow === 0 || todayDow === 6) return []; // weekends have no timetable
    const week = weeksInTerm.find(w => {
      const startISO = toISODate(w.startDate);
      const endISO = toISODate(addDays(w.startDate, 4));
      return todayISO >= startISO && todayISO <= endISO;
    });
    if (!week) return [];
    const timetable = week.weekNumber === 1 ? timetableWeek1 : timetableWeek2;
    const dayName = DAYS[todayDow - 1];
    const daySchedule = (timetable[dayName] || {}) as Record<string, any>;
    const lessons: { period: string; subject: string; hasPlan: boolean }[] = [];
    PERIOD_LABELS.forEach(period => {
      const entry = daySchedule[period];
      if (entry?.subject) {
        const plan = lessonPlans[`${todayISO}_${period}`];
        const hasPlan = !!(plan && (plan.title || plan.notes || (plan.links && plan.links.length > 0)));
        lessons.push({ period, subject: entry.subject, hasPlan });
      }
    });
    return lessons;
  }, [weeksInTerm, timetableWeek1, timetableWeek2, lessonPlans]);

  // Key dates in the next ~14 days for the briefing panel.
  const upcomingKeyDates = useMemo(() => {
    const todayISO = new Date().toISOString().split('T')[0];
    const horizonISO = toISODate(addDays(new Date(), 14));
    return keyDates
      .filter(kd => kd.dateStr >= todayISO && kd.dateStr <= horizonISO)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
      .slice(0, 8)
      .map(kd => ({ title: kd.title, dateStr: kd.dateStr }));
  }, [keyDates]);

  // --- Effects ---

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Load data from Firebase on mount (only if user is logged in)
  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      setIsDataLoading(true);
      try {
        const [plans, tasks, projs, cats, routines, fetchedIdeas, fetchedApps, fetchedAppCategories, fetchedKeyDates] = await Promise.all([
            fetchLessonPlans(),
            fetchTasks(),
            fetchProjects(),
            fetchCategories(),
            fetchRoutineTasks(),
            fetchIdeas(),
            fetchApps(),
            fetchAppCategories(),
            fetchKeyDates()
        ]);
        setLessonPlans(plans);
        setGlobalTasks(tasks);
        setProjects(projs);
        setCategories(cats);
        setRoutineTasks(routines);
        setIdeas(fetchedIdeas);
        setApps(fetchedApps);
        setAppCategories(fetchedAppCategories);
        setKeyDates(fetchedKeyDates);
      } catch (e) {
        console.error("Failed to load data from DB", e);
      } finally {
        setIsDataLoading(false);
      }
    };
    loadData();
  }, [user]);

  // --- Theme Logic ---
  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem('eduPlan_theme', theme);

    const applyTheme = (t: Theme) => {
      if (t === 'dark') {
        root.classList.add('dark');
      } else if (t === 'light') {
        root.classList.remove('dark');
      } else {
        // System
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme(theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // --- Handlers ---

  const handleTermChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTermId(e.target.value);
    setSelectedWeekIndex(0);
  };

  const handlePrevWeek = () => {
    if (selectedWeekIndex > 0) setSelectedWeekIndex(prev => prev - 1);
  };

  const handleNextWeek = () => {
    if (selectedWeekIndex < weeksInTerm.length - 1) setSelectedWeekIndex(prev => prev + 1);
  };

  const handleJumpToCurrent = () => {
    const now = new Date();
    // Re-run the logic to find current
    let term = terms.find(t => now >= t.startDate && now <= t.endDate);
    if (!term) term = terms.find(t => t.startDate > now) || terms[terms.length - 1];
    
    if (term) {
        setSelectedTermId(term.id);
        const weeks = generateWeeksForTerm(term);
        const idx = weeks.findIndex(w => {
            const end = addDays(w.startDate, 7);
            return now >= w.startDate && now < end;
        });
        if (idx !== -1) setSelectedWeekIndex(idx);
        else {
            const nextIdx = weeks.findIndex(w => w.startDate > now);
            setSelectedWeekIndex(nextIdx !== -1 ? nextIdx : 0);
        }
    }
  };

  const getLessonKey = (dateStr: string, periodLabel: string) => `${dateStr}_${periodLabel}`;

  const openLessonModal = (dateStr: string, periodLabel: string, subjectName: string) => {
    setEditingLessonKey(getLessonKey(dateStr, periodLabel));
    setEditingSubjectName(subjectName);
    setIsModalOpen(true);
  };

  const handleSaveLesson = async (updatedLesson: LessonPlan) => {
    if (isReadOnly) return;
    
    // Optimistic Update
    setLessonPlans(prev => ({
      ...prev,
      [updatedLesson.id]: updatedLesson
    }));
    
    // Save to DB
    await saveLessonPlan(updatedLesson);
  };

  const handleBatchSaveLessons = async (lessons: LessonPlan[]) => {
    if (isReadOnly) return;

    // Optimistic Update
    setLessonPlans(prev => {
        const next = { ...prev };
        lessons.forEach(l => {
            next[l.id] = l;
        });
        return next;
    });

    // Save to DB (in parallel)
    try {
        await Promise.all(lessons.map(l => saveLessonPlan(l)));
    } catch (e) {
        console.error("Batch save failed", e);
    }
  };

  const handleDeleteLesson = async () => {
    if (!editingLessonKey || isReadOnly) return;
    
    // Optimistic Update
    setLessonPlans(prev => {
      const newState = { ...prev };
      delete newState[editingLessonKey];
      return newState;
    });
    
    // Delete from DB
    await deleteLessonPlan(editingLessonKey);
    setIsModalOpen(false);
  };

  const toggleTaskCompletion = async (e: React.MouseEvent, taskId: string, parentTaskId?: string) => {
    e.stopPropagation();
    const isTestBypass = !user && window.location.search.includes('bypass_login=true');
    const actualIsReadOnly = isTestBypass ? false : isReadOnly;
    if (actualIsReadOnly) return;

    if (parentTaskId) {
        // Toggle subtask
        const parentTask = globalTasks.find(t => t.id === parentTaskId);
        if (!parentTask) return;

        const subtask = parentTask.subtasks?.find(st => st.id === taskId);
        if (!subtask) return;

        let nextStatus: Task['status'] = 'Uncompleted';
        if (subtask.status === 'Uncompleted') nextStatus = 'In Progress';
        else if (subtask.status === 'In Progress') nextStatus = 'Completed';
        else nextStatus = 'Uncompleted';

        const updatedSubtasks = parentTask.subtasks!.map(st =>
            st.id === taskId ? { ...st, status: nextStatus } : st
        );
        const updatedParent = { ...parentTask, subtasks: updatedSubtasks };

        setGlobalTasks(prev => prev.map(t => t.id === parentTaskId ? updatedParent : t));
        if (cardTask?.id === parentTaskId || cardTask?.id === taskId) {
            setCardTask(updatedParent.subtasks!.find(st => st.id === taskId) || updatedParent);
        }

        try {
            await saveTask(updatedParent);
        } catch (e) {
            console.error(e);
            setGlobalTasks(prev => prev.map(t => t.id === parentTaskId ? parentTask : t));
            if (cardTask?.id === parentTaskId || cardTask?.id === taskId) {
                setCardTask(parentTask);
            }
        }
        return;
    }

    // Regular task
    const task = globalTasks.find(t => t.id === taskId);
    if (!task) return;

    let nextStatus: Task['status'] = 'Uncompleted';
    if (task.status === 'Uncompleted') nextStatus = 'In Progress';
    else if (task.status === 'In Progress') nextStatus = 'Completed';
    else nextStatus = 'Uncompleted';

    const updated = { ...task, status: nextStatus };

    // Optimistic Update
    setGlobalTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    if (cardTask?.id === taskId) {
        setCardTask(updated);
    }

    try {
        await saveTask(updated);
    } catch (e) {
        console.error(e);
        // Revert
        setGlobalTasks(prev => prev.map(t => t.id === taskId ? task : t));
        if (cardTask?.id === taskId) {
            setCardTask(task);
        }
    }
  };

  const handleEditTaskSave = async (updatedTask: Task) => {
    if (isReadOnly) return;

    setIsTaskModalOpen(false);

    if (updatedTask._isSubtaskDisplay && updatedTask._parentTaskId) {
        const parentTask = globalTasks.find(t => t.id === updatedTask._parentTaskId);
        if (!parentTask) return;

        const updatedSubtasks = parentTask.subtasks!.map(st =>
            st.id === updatedTask.id ? updatedTask : st
        );
        const updatedParent = { ...parentTask, subtasks: updatedSubtasks };

        // Optimistic update for subtask
        setGlobalTasks(prev => prev.map(t => t.id === updatedParent.id ? updatedParent : t));

        try {
            await saveTask(updatedParent);
        } catch (e) {
            console.error("Failed to save edited subtask", e);
            // Revert
            setGlobalTasks(prev => prev.map(t => t.id === parentTask.id ? parentTask : t));
        }
        return;
    }

    // Optimistic update for regular task
    setGlobalTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));

    try {
        await saveTask(updatedTask);
    } catch (e) {
        console.error("Failed to save edited task", e);
        // Reload to revert
        const tasks = await fetchTasks();
        setGlobalTasks(tasks);
    }
  };

  const openTaskModal = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const openCardModal = (task: Task) => {
      setCardTask(task);
      setIsCardModalOpen(true);
  };

  const toggleCompletion = async (e: React.MouseEvent, dateStr: string, periodLabel: string) => {
    e.stopPropagation();
    const isTestBypass = !user && window.location.search.includes('bypass_login=true');
    const actualIsReadOnly = isTestBypass ? false : isReadOnly;
    if (actualIsReadOnly) return;

    const key = getLessonKey(dateStr, periodLabel);
    const existing = lessonPlans[key];
    
    if (existing) {
        const updated = { ...existing, completed: !existing.completed };
        
        // Optimistic Update
        setLessonPlans(prev => ({
            ...prev,
            [key]: updated
        }));

        // Save to DB
        await saveLessonPlan(updated);
    }
  };

  const handleAddKeyDate = async (newKeyDate: KeyDate) => {
    if (actualIsReadOnly) return;
    setKeyDates(prev => [...prev, newKeyDate]);
    await saveKeyDate(newKeyDate);
  };

  const handleEditKeyDate = async (updatedKeyDate: KeyDate) => {
    if (actualIsReadOnly) return;
    setKeyDates(prev => prev.map(k => k.id === updatedKeyDate.id ? updatedKeyDate : k));
    await saveKeyDate(updatedKeyDate);
  };

  const handleDeleteKeyDate = async (id: string) => {
    if (actualIsReadOnly) return;
    setKeyDates(prev => prev.filter(k => k.id !== id));
    await deleteKeyDate(id);
  };

  const isRoutineCompleted = (task: RoutineTask, targetDateStr: string) => {
    // If we have history, check it directly
    if (task.completedDatesStr && task.completedDatesStr.includes(targetDateStr)) {
        return true;
    }

    if (task.type === 'daily' || !task.type) {
         return task.lastCompletedDateStr === targetDateStr;
    } else {
         // Weekly tasks: if no history matches, try the legacy logic for backwards compatibility
         if (!task.lastCompletedDateStr) return false;

         const [tYear, tMonth, tDay] = targetDateStr.split('-').map(Number);
         const targetDate = new Date(tYear, tMonth - 1, tDay);
         targetDate.setHours(0,0,0,0);

         if (!task.daysOfWeek || task.daysOfWeek.length === 0) return task.lastCompletedDateStr === targetDateStr;

         let mostRecentScheduledDate = new Date(targetDate);
         let found = false;

         for (let i = 0; i < 7; i++) {
             const testDate = new Date(targetDate);
             testDate.setDate(targetDate.getDate() - i);
             if (task.daysOfWeek.includes(testDate.getDay())) {
                 mostRecentScheduledDate = testDate;
                 found = true;
                 break;
             }
         }

         if (!found) return false;

         const [year, month, day] = task.lastCompletedDateStr.split('-').map(Number);
         const lastCompletedDate = new Date(year, month - 1, day);
         lastCompletedDate.setHours(0,0,0,0);

         // We only consider it completed for the target date if the legacy lastCompletedDate was completed exactly on or after the most recent scheduled date, AND the targetDate is exactly the most recent scheduled date.
         // Otherwise, it bleeds into past dates.
         if (targetDate.getTime() === mostRecentScheduledDate.getTime() && lastCompletedDate >= mostRecentScheduledDate) {
             return true;
         }
         return false;
    }
  };

  const handleToggleRoutineTask = async (e: React.MouseEvent, task: RoutineTask, targetDateStr: string) => {
    e.stopPropagation();
    const isTestBypass = !user && window.location.search.includes('bypass_login=true');
    const actualIsReadOnly = isTestBypass ? false : isReadOnly;
    if (actualIsReadOnly) return;
    const currentlyCompleted = isRoutineCompleted(task, targetDateStr);

    // Manage completed history
    let newCompletedDatesStr = task.completedDatesStr ? [...task.completedDatesStr] : [];

    // Migrate legacy to history if it exists and isn't already there
    if (task.lastCompletedDateStr && !newCompletedDatesStr.includes(task.lastCompletedDateStr)) {
        newCompletedDatesStr.push(task.lastCompletedDateStr);
    }

    if (currentlyCompleted) {
        newCompletedDatesStr = newCompletedDatesStr.filter(d => d !== targetDateStr);
    } else {
        newCompletedDatesStr.push(targetDateStr);
    }

    const updated = {
        ...task,
        completedDatesStr: newCompletedDatesStr,
        lastCompletedDateStr: newCompletedDatesStr.length > 0 ? newCompletedDatesStr[newCompletedDatesStr.length - 1] : undefined
    };

    setRoutineTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    try {
        await saveRoutineTask(updated);
    } catch (e) {
        console.error("Failed to toggle routine task", e);
        setRoutineTasks(prev => prev.map(t => t.id === task.id ? task : t));
    }
  };

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lessonPlans));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "lesson_plans_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return <Sun size={18} />;
      case 'dark': return <Moon size={18} />;
      case 'system': return <Monitor size={18} />;
    }
  };

  // --- AI Chat Logic ---

  // Helper to strip UI data from timetable for AI context to save tokens/confusion
  const getSimplifiedTimetable = (tt: WeeklyTimetable) => {
    const simple: Record<string, Record<string, string>> = {};
    DAYS.forEach(day => {
      simple[day] = {};
      PERIOD_LABELS.forEach(period => {
        const entry = tt[day][period];
        simple[day][period] = entry ? entry.subject : "Free / Admin";
      });
    });
    return simple;
  };

  const handleUndoLastAiAction = async () => {
    if (aiActionHistory.length === 0 || isReadOnly) return;

    const lastActions = aiActionHistory[aiActionHistory.length - 1];

    // We assume the payload is an array of old LessonPlan objects (or null if they were newly created)
    if (lastActions.type === 'updateLessons') {
       const previousPlans = lastActions.previousState as Array<LessonPlan | {id: string, deleted: true}>;

       // Optimistic update
       setLessonPlans(prev => {
          const next = { ...prev };
          previousPlans.forEach(p => {
             if ('deleted' in p) {
                 delete next[p.id];
             } else {
                 next[p.id] = p as LessonPlan;
             }
          });
          return next;
       });

       // Save to DB
       try {
           await Promise.all(previousPlans.map(p => {
               if ('deleted' in p) {
                   return deleteLessonPlan(p.id);
               } else {
                   return saveLessonPlan(p as LessonPlan);
               }
           }));
       } catch (e) {
           console.error("Failed to undo actions in DB", e);
       }
    }

    setAiActionHistory(prev => prev.slice(0, -1));
    setChatMessages(prev => [...prev, { role: 'model', text: 'I have undone my last changes to your planner.' }]);
  };

  const handleAiSendMessage = async (userMessage: string, fileData?: { text: string, mimeType: string, isBase64: boolean }) => {
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage + (fileData ? ' [File Attached]' : '') }]);
    setIsAiLoading(true);

    try {
      if (!currentWeekData) throw new Error("No active week data");

      const apiKey = window.ENV?.GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || window.ENV?.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      // Build context about the current week's timetable
      const timetable = currentWeekData.weekNumber === 1 ? timetableWeek1 : timetableWeek2;
      let contextString = `Current Week Context: ${currentWeekData.displayString} (Week ${currentWeekData.weekNumber}).\n`;
      contextString += `Today is: ${new Date().toDateString()}.\n\n`;
      
      // Add Entire Academic Year Calendar Context
      contextString += `--- ACADEMIC YEAR CALENDAR ---\n`;
      let allWeeksInYear: WeekData[] = [];
      terms.forEach(term => {
          allWeeksInYear = allWeeksInYear.concat(generateWeeksForTerm(term));
      });
      allWeeksInYear.forEach(w => {
        const end = addDays(w.startDate, 4);
        contextString += `Week ${w.weekNumber}: ${toISODate(w.startDate)} to ${toISODate(end)}\n`;
      });

      // Add Master Timetables
      contextString += `\n--- MASTER TIMETABLE DEFINITIONS ---\n`;
      contextString += `(Week 1 Schedule)\n${JSON.stringify(getSimplifiedTimetable(timetableWeek1), null, 2)}\n`;
      contextString += `(Week 2 Schedule)\n${JSON.stringify(getSimplifiedTimetable(timetableWeek2), null, 2)}\n\n`;

      // Add Colleague Timetables
      contextString += `\n--- COLLEAGUE TIMETABLES ---\n`;
      contextString += `Use this data when the user asks about colleague availability or meeting times.\n`;
      INITIAL_COLLEAGUES.forEach(colleague => {
        contextString += `\n${colleague.name}:\n`;
        contextString += `Week 1: ${JSON.stringify(colleague.week1, null, 2)}\n`;
        contextString += `Week 2: ${JSON.stringify(colleague.week2, null, 2)}\n`;
      });
      contextString += `\n----------------------------\n\n`;

      contextString += `\n--- APP TASKS & PROJECTS ---\n`;
      contextString += `Projects: ${JSON.stringify(projects.map(p => ({id: p.id, name: p.name, desc: p.description})), null, 2)}\n`;
      contextString += `Tasks: ${JSON.stringify(globalTasks.map(t => ({id: t.id, title: t.title, status: t.status, desc: t.description, project: projects.find(p=>p.id===t.projectId)?.name})), null, 2)}\n`;
      contextString += `\n----------------------------\n\n`;

      contextString += `\n--- ENTIRE DATABASE CONTENT ---\n`;
      contextString += `This section contains ALL historical, current, and future data from the teacher planner database across all collections. You can use this to answer questions about any time period.\n\n`;
      
      contextString += `App Categories: ${JSON.stringify(appCategories, null, 2)}\n`;
      contextString += `Apps: ${JSON.stringify(apps.map(a => ({name: a.name, category: appCategories.find(c=>c.id===a.categoryId)?.name})), null, 2)}\n`;
      contextString += `Project Categories: ${JSON.stringify(categories.map(c => ({id: c.id, name: c.name})), null, 2)}\n`;
      contextString += `Ideas: ${JSON.stringify(ideas.map(i => ({text: i.text, project: projects.find(p=>p.id===i.projectId)?.name})), null, 2)}\n`;
      contextString += `Routine Tasks: ${JSON.stringify(routineTasks.map(r => ({title: r.title, type: r.type})), null, 2)}\n`;
      contextString += `Key Dates: ${JSON.stringify(keyDates, null, 2)}\n`;

      // Compute subjects for all lesson plans to make it easy for the AI
      const computedLessonPlans = Object.values(lessonPlans).map(p => {
          const dateObj = new Date(p.dateStr);
          const weekIdx = allWeeksInYear.findIndex(w => {
              const end = addDays(w.startDate, 7);
              return dateObj >= w.startDate && dateObj < end;
          });

          let subject = "Unknown";
          if (weekIdx !== -1) {
              const week = allWeeksInYear[weekIdx];
              const dayIndex = dateObj.getDay();
              const dayStr = DAYS[dayIndex - 1]; // 0=Sunday, so -1 for Monday index if using DAYS
              if (dayStr) {
                  const tt = week.weekNumber === 1 ? timetableWeek1 : timetableWeek2;
                  const entry = tt[dayStr]?.[p.periodLabel];
                  if (entry) {
                      subject = entry.subject;
                  }
              }
          }
          return {
              date: p.dateStr,
              period: p.periodLabel,
              subject: subject,
              title: p.title,
              type: p.type,
              notes: p.notes ? p.notes.substring(0, 50) + "..." : undefined
          };
      });

      contextString += `Lesson Plans (All historical and future): ${JSON.stringify(computedLessonPlans, null, 2)}\n`;
      contextString += `\n----------------------------\n\n`;

      contextString += `--- CURRENT WEEK EXISTING PLANS ---\n`;
      DAYS.forEach((day, idx) => {
        const date = addDays(currentWeekData.startDate, idx);
        const dateStr = toISODate(date);
        contextString += `${day} (${dateStr}):\n`;
        PERIOD_LABELS.forEach(period => {
           const entry = timetable[day][period];
           const subject = entry ? entry.subject : "Free Period";
           const existingPlan = lessonPlans[getLessonKey(dateStr, period)];
           const status = existingPlan ? `(${existingPlan.type || 'Lesson'} Planned: "${existingPlan.title}")` : "(No plan)";
           contextString += `  - ${period}: ${subject} ${status}\n`;
        });
      });
      contextString += `\n----------------------------\n\n`;

      // Define Function Tool (Only for Admins)
      const updateLessonTool: FunctionDeclaration = {
        name: 'updateLesson',
        description: 'Add or update a single lesson plan or meeting for a specific date.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            dateStr: { type: Type.STRING, description: 'YYYY-MM-DD format.' },
            periodLabel: { type: Type.STRING, description: 'Exact period label, e.g., "Period 2".' },
            type: { type: Type.STRING, enum: ['lesson', 'meeting'], description: 'Defaults to lesson.' },
            title: { type: Type.STRING },
            notes: { type: Type.STRING },
            links: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['dateStr', 'periodLabel', 'title'],
        },
      };

      const addRecurringLessonTool: FunctionDeclaration = {
        name: 'addRecurringLesson',
        description: 'Add a lesson or meeting repeatedly (e.g., every Monday, every Week 1 Friday) for the entire academic year (all terms).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            dayOfWeek: { type: Type.STRING, enum: DAYS, description: 'Monday, Tuesday, Wednesday, Thursday, or Friday' },
            periodLabel: { type: Type.STRING, description: 'Exact period label, e.g., "Period 1"' },
            title: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['lesson', 'meeting'] },
            weekCycle: { type: Type.STRING, enum: ['all', 'week1', 'week2'], description: 'Apply to all weeks, only Week 1s, or only Week 2s. Default is all.' },
            notes: { type: Type.STRING },
          },
          required: ['dayOfWeek', 'periodLabel', 'title']
        }
      };

      const addTaskToProjectTool: FunctionDeclaration = {
        name: 'addTaskToProject',
        description: 'Add a new task to an existing project.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            projectId: { type: Type.STRING, description: 'The ID of the project.' },
            title: { type: Type.STRING, description: 'Task title.' },
            description: { type: Type.STRING, description: 'Task notes or description.' },
            priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'], description: 'Default is Medium.' }
          },
          required: ['projectId', 'title']
        }
      };

      const addKeyDateTool: FunctionDeclaration = {
        name: 'addKeyDate',
        description: 'Add a new key date to the calendar.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Title or name of the key date event.' },
            dateStr: { type: Type.STRING, description: 'The date in YYYY-MM-DD format.' },
            time: { type: Type.STRING, description: 'Optional time for the event (e.g. 14:00).' },
            isAllDay: { type: Type.BOOLEAN, description: 'Whether the event is an all day event.' },
            notes: { type: Type.STRING, description: 'Optional notes for the event.' }
          },
          required: ['title', 'dateStr']
        }
      };

      const editKeyDateTool: FunctionDeclaration = {
        name: 'editKeyDate',
        description: 'Edit an existing key date on the calendar.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'The ID of the key date to edit.' },
            title: { type: Type.STRING, description: 'Title or name of the key date event.' },
            dateStr: { type: Type.STRING, description: 'The date in YYYY-MM-DD format.' },
            time: { type: Type.STRING, description: 'Optional time for the event (e.g. 14:00).' },
            isAllDay: { type: Type.BOOLEAN, description: 'Whether the event is an all day event.' },
            notes: { type: Type.STRING, description: 'Optional notes for the event.' }
          },
          required: ['id']
        }
      };

      const deleteKeyDateTool: FunctionDeclaration = {
        name: 'deleteKeyDate',
        description: 'Delete an existing key date from the calendar.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'The ID of the key date to delete.' }
          },
          required: ['id']
        }
      };

      let systemInstruction = `You are an expert teacher's assistant. You help plan lessons, meetings, manage project tasks, and handle key calendar dates.
           
           CRITICAL INSTRUCTIONS ON CAPABILITIES & TOOL USAGE:
           - You HAVE FULL ACCESS to ALL historical, current, and future lesson plans in the database.
           - You CAN search by class name or subject. Look at the "Lesson Plans (All historical and future)" list in the context below. It includes the "subject" (which is the class name, e.g., "10B", "Year 12 Maths") and the date for every single lesson.
           - DO NOT ever say you cannot access future plans or search by class name. You have all the data you need.
           - DANGER: DO NOT USE THE \`updateLesson\` or \`addRecurringLesson\` TOOLS UNLESS EXPLICITLY TOLD TO ADD, CREATE, OR CHANGE A LESSON. If a user says "do it again", "tell me what I have", or "I have updated some so do it again", they are asking you to read the context and reply with text. Do NOT modify the database on their behalf unless they say "add these to my planner" or "create a lesson".
           - NEVER fill in empty periods, supervised study, or revision sessions on your own initiative. ONLY create lessons when strictly requested.

           TOOL TRIGGERS — only call a mutating tool when the user uses an explicit create/change verb such as "add", "create", "schedule", "update", "change", "delete", or "remove". For any other request (questions, summaries, "what do I have", "tell me", "do it again" without a clear new instruction), reply with TEXT ONLY and call no tools. The user will be asked to confirm before any change is applied, so never assume consent.

           RULES:
           1. You have access to ALL historical, current, and future lesson plans, tasks, projects, ideas, and routines in the database.
           2. Default to planning for the Current Week unless the user explicitly mentions "next week", "future weeks", or specific dates.
           3. If the user asks for a "Meeting", set the 'type' parameter to 'meeting'.
           4. If the user asks to plan for the "whole year", "every week", "rest of the term", or "entire academic year", and they EXPLICITLY want you to create them, you MUST use the 'addRecurringLesson' tool. Do NOT try to call 'updateLesson' 40 times.
           5. 'addRecurringLesson' handles all date calculations for you. Just pass the day (e.g. "Monday"), the period, and the cycle (all/week1/week2).
           6. If the user uploads a document (e.g., meeting notes, email) and asks you to extract action items, you MUST use the 'addTaskToProject' tool for EACH action item you find if they specify a project to add them to.
           
           ${contextString}`;

      if (isReadOnly) {
          systemInstruction += `\n\nNOTE: The current user is in READ-ONLY mode. You CANNOT add, update, or delete any plans or tasks. You can only view and analyze the data.`;
      }

      // Initialize Chat using new SDK pattern
      const chat: Chat = ai.chats.create({
        model: TEXT_MODEL,
        config: {
          systemInstruction: systemInstruction,
          // Only provide tools if user is admin
          tools: isAdmin ? [{ functionDeclarations: [updateLessonTool, addRecurringLessonTool, addTaskToProjectTool, addKeyDateTool, editKeyDateTool, deleteKeyDateTool] }] : undefined
        }
      });

      let finalMessage: any = userMessage;
      if (fileData) {
         if (fileData.isBase64) {
             finalMessage = [
                 userMessage,
                 { inlineData: { data: fileData.text, mimeType: fileData.mimeType } }
             ];
         } else {
             finalMessage = `User Message: ${userMessage}\n\nAttached Document Content:\n${fileData.text}`;
         }
      }
      
      const response = await chat.sendMessage({ message: finalMessage });

      // Handle Function Calls
      const functionCalls = response.functionCalls;
      let finalText = response.text || "";

      if (functionCalls && functionCalls.length > 0) {
        // Double check admin status before execution
        if (isReadOnly) {
            finalText = "I cannot modify the planner as you are in read-only mode.";
        } else {
            // Defer mutating actions until the user explicitly confirms them.
            const summary = describeFunctionCalls(functionCalls);
            setPendingActions({ calls: functionCalls, summary });
            if (!finalText) {
                finalText = "I've prepared the following change(s). Please confirm to apply them.";
            }
        }
      }

      setChatMessages(prev => [...prev, { role: 'model', text: finalText }]);

    } catch (error) {
      console.error("AI Error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error connecting to Gemini. Please check console for details." }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Human-readable summary of pending AI actions, shown in the confirmation prompt.
  const describeFunctionCalls = (functionCalls: any[]): string => {
    return functionCalls.map(call => {
      const a = (call.args || {}) as any;
      switch (call.name) {
        case 'updateLesson':
          return `• Add ${a.type === 'meeting' ? 'meeting' : 'lesson'} "${a.title}" on ${a.dateStr} (${a.periodLabel})`;
        case 'addRecurringLesson':
          return `• Add recurring "${a.title}" every ${a.dayOfWeek} (${a.periodLabel}, ${a.weekCycle || 'all'} weeks)`;
        case 'addTaskToProject':
          return `• Add task "${a.title}"${a.priority ? ` [${a.priority}]` : ''}`;
        case 'addKeyDate':
          return `• Add key date "${a.title}" on ${a.dateStr}`;
        case 'editKeyDate':
          return `• Edit key date "${a.title || a.id}"`;
        case 'deleteKeyDate':
          return `• Delete key date ${a.id}`;
        default:
          return `• ${call.name}`;
      }
    }).join('\n');
  };

  const handleCancelActions = () => {
    setPendingActions(null);
    setChatMessages(prev => [...prev, { role: 'model', text: "No problem — I've left your planner unchanged." }]);
  };

  const handleConfirmActions = async () => {
    if (!pendingActions || isReadOnly) return;
    const functionCalls = pendingActions.calls;
    setPendingActions(null);
    setIsAiLoading(true);
    try {
            const functionResponses: any[] = [];
            const modificationsToTrack: any[] = [];

            for (const call of functionCalls) {
                if (call.name === 'updateLesson') {
                    const args = call.args as any;
                    const key = getLessonKey(args.dateStr, args.periodLabel);
                    const existingPlan = lessonPlans[key];
                    if (existingPlan) {
                        modificationsToTrack.push({ ...existingPlan });
                    } else {
                        modificationsToTrack.push({ id: key, deleted: true });
                    }

                    const newPlan: LessonPlan = {
                        id: key,
                        dateStr: args.dateStr,
                        periodLabel: args.periodLabel,
                        title: args.title,
                        type: (args.type as 'lesson' | 'meeting') || 'lesson',
                        notes: args.notes || "",
                        links: args.links || [],
                        completed: false
                    };
                    
                    setLessonPlans(prev => ({ ...prev, [key]: newPlan }));
                    await saveLessonPlan(newPlan);

                    functionResponses.push({
                        functionResponse: {
                            name: call.name,
                            id: call.id,
                            response: { result: `Success: ${newPlan.type} "${newPlan.title}" added to planner for ${args.dateStr}.` }
                        }
                    });
                } else if (call.name === 'addRecurringLesson') {
                   const args = call.args as any;
                   const dayOfWeek = args.dayOfWeek;
                   const periodLabel = args.periodLabel;
                   const weekCycle = args.weekCycle || 'all'; // all, week1, week2
                   const title = args.title;
                   
                   const createdPlans: LessonPlan[] = [];
                   const dayIndex = DAYS.indexOf(dayOfWeek);

                   if (dayIndex === -1) {
                      functionResponses.push({
                        functionResponse: {
                            name: call.name,
                            id: call.id,
                            response: { error: `Invalid day of week: ${dayOfWeek}` }
                        }
                      });
                      continue;
                   }

                   // Generate ALL weeks for ALL terms for the year
                   const allWeeks: WeekData[] = [];
                   terms.forEach(term => {
                      allWeeks.push(...generateWeeksForTerm(term));
                   });

                   for (const week of allWeeks) {
                      // Filter by cycle
                      if (weekCycle === 'week1' && week.weekNumber !== 1) continue;
                      if (weekCycle === 'week2' && week.weekNumber !== 2) continue;

                      const targetDate = addDays(week.startDate, dayIndex);
                      const dateStr = toISODate(targetDate);
                      
                      const key = getLessonKey(dateStr, periodLabel);

                      const existingPlan = lessonPlans[key];
                      if (existingPlan) {
                          modificationsToTrack.push({ ...existingPlan });
                      } else {
                          modificationsToTrack.push({ id: key, deleted: true });
                      }

                      createdPlans.push({
                          id: key,
                          dateStr: dateStr,
                          periodLabel: periodLabel,
                          title: title,
                          type: (args.type as 'lesson' | 'meeting') || 'lesson',
                          notes: args.notes || "",
                          links: [],
                          completed: false
                      });
                   }

                   // Update State
                   setLessonPlans(prev => {
                      const next = { ...prev };
                      createdPlans.forEach(p => { next[p.id] = p; });
                      return next;
                   });

                   // Save to DB (Batch)
                   try {
                     await Promise.all(createdPlans.map(p => saveLessonPlan(p)));
                     functionResponses.push({
                        functionResponse: {
                            name: call.name,
                            id: call.id,
                            response: { result: `Success: Added ${createdPlans.length} recurring entries for ${title} on ${dayOfWeek}s.` }
                        }
                     });
                   } catch (e) {
                      console.error(e);
                      functionResponses.push({
                        functionResponse: {
                            name: call.name,
                            id: call.id,
                            response: { error: `Failed to save batch plans.` }
                        }
                     });
                   }
                } else if (call.name === 'addTaskToProject') {
                    const args = call.args as any;
                    const newTask: Task = {
                        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        projectId: args.projectId,
                        title: args.title,
                        description: args.description || undefined,
                        priority: args.priority || 'Medium',
                        status: 'Uncompleted',
                        subtasks: []
                    };

                    try {
                        await saveTask(newTask);
                        setGlobalTasks(prev => [...prev, newTask]);
                        functionResponses.push({
                            functionResponse: {
                                name: call.name,
                                id: call.id,
                                response: { result: `Success: Added task "${newTask.title}" to project.` }
                            }
                        });
                    } catch (e) {
                        console.error(e);
                        functionResponses.push({
                            functionResponse: {
                                name: call.name,
                                id: call.id,
                                response: { error: `Failed to save task.` }
                            }
                        });
                    }
                } else if (call.name === 'addKeyDate') {
                    const args = call.args as any;
                    const newKeyDate: KeyDate = {
                        id: `kd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        title: args.title,
                        dateStr: args.dateStr,
                        time: args.time,
                        isAllDay: args.isAllDay !== undefined ? args.isAllDay : true,
                        notes: args.notes,
                        colorClass: 'bg-slate-200', // Default color
                        createdAt: Date.now()
                    };
                    try {
                        await saveKeyDate(newKeyDate);
                        setKeyDates(prev => [...prev, newKeyDate]);
                        functionResponses.push({
                            functionResponse: {
                                name: call.name,
                                id: call.id,
                                response: { result: `Success: Added key date "${newKeyDate.title}" for ${newKeyDate.dateStr}.` }
                            }
                        });
                    } catch (e) {
                         functionResponses.push({
                            functionResponse: {
                                name: call.name,
                                id: call.id,
                                response: { error: `Failed to add key date.` }
                            }
                        });
                    }
                } else if (call.name === 'editKeyDate') {
                    const args = call.args as any;
                    const existingKeyDate = keyDates.find(k => k.id === args.id);
                    if (!existingKeyDate) {
                        functionResponses.push({
                            functionResponse: {
                                name: call.name,
                                id: call.id,
                                response: { error: `Key date not found.` }
                            }
                        });
                        continue;
                    }

                    const updatedKeyDate: KeyDate = {
                        ...existingKeyDate,
                        title: args.title || existingKeyDate.title,
                        dateStr: args.dateStr || existingKeyDate.dateStr,
                        time: args.time !== undefined ? args.time : existingKeyDate.time,
                        isAllDay: args.isAllDay !== undefined ? args.isAllDay : existingKeyDate.isAllDay,
                        notes: args.notes !== undefined ? args.notes : existingKeyDate.notes
                    };

                    try {
                        await saveKeyDate(updatedKeyDate);
                        setKeyDates(prev => prev.map(k => k.id === args.id ? updatedKeyDate : k));
                        functionResponses.push({
                            functionResponse: {
                                name: call.name,
                                id: call.id,
                                response: { result: `Success: Edited key date "${updatedKeyDate.title}".` }
                            }
                        });
                    } catch (e) {
                         functionResponses.push({
                            functionResponse: {
                                name: call.name,
                                id: call.id,
                                response: { error: `Failed to edit key date.` }
                            }
                        });
                    }
                } else if (call.name === 'deleteKeyDate') {
                    const args = call.args as any;
                    try {
                        await deleteKeyDate(args.id);
                        setKeyDates(prev => prev.filter(k => k.id !== args.id));
                        functionResponses.push({
                            functionResponse: {
                                name: call.name,
                                id: call.id,
                                response: { result: `Success: Deleted key date with ID ${args.id}.` }
                            }
                        });
                    } catch (e) {
                         functionResponses.push({
                            functionResponse: {
                                name: call.name,
                                id: call.id,
                                response: { error: `Failed to delete key date.` }
                            }
                        });
                    }
                }
            }

            // Build a confirmation summary from the executed results (no model round-trip needed).
            const okCount = functionResponses.filter(r => r.functionResponse?.response?.result).length;
            const errors = functionResponses
                .map(r => r.functionResponse?.response?.error)
                .filter(Boolean) as string[];

            if (modificationsToTrack.length > 0) {
                setAiActionHistory(prev => [...prev, { type: 'updateLessons', previousState: modificationsToTrack }]);
            }

            let confirmText = okCount > 0 ? `Done — applied ${okCount} change${okCount === 1 ? '' : 's'} to your planner.` : "";
            if (errors.length > 0) {
                confirmText += `${confirmText ? '\n\n' : ''}Some changes failed:\n${errors.map(e => `• ${e}`).join('\n')}`;
            }
            if (!confirmText) confirmText = "No changes were applied.";

            setChatMessages(prev => [...prev, { role: 'model', text: confirmText }]);
    } catch (error) {
      console.error("AI Confirm Error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: "Sorry, something went wrong applying those changes. Please check the console." }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- Render Helpers ---

  // Get the lesson plan for the modal (or create a blank one)
  const getEditingLessonData = (): LessonPlan => {
    if (!editingLessonKey || !currentWeekData) return {
      id: '', dateStr: '', periodLabel: '', title: '', links: [], notes: '', completed: false, type: 'lesson'
    };

    const [dateStr, periodLabel] = editingLessonKey.split('_');
    
    // Smart default type: If it's a meeting column, default to 'meeting'
    const defaultType = (periodLabel.includes('Mtg') || periodLabel.includes('Meeting')) ? 'meeting' : 'lesson';
    const existingPlan = lessonPlans[editingLessonKey];

    return existingPlan || {
      id: editingLessonKey,
      dateStr,
      periodLabel,
      title: '',
      links: [],
      notes: '',
      completed: false,
      type: defaultType
    };
  };

  // --- Main Render ---

  if (authLoading || isPlannerDataLoading || (!hasInitializedState && terms.length > 0)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  // Force bypass login for playwright tests.
  const isTestBypass = window.location.search.includes('bypass_login=true');
  if (isTestBypass) {
     // we'll pretend there is an admin user
     if (!user || user.uid !== ADMIN_UID) {
         setUser({ uid: ADMIN_UID, displayName: 'Test Admin' } as any);
         setAuthLoading(false);
         return null; // Force re-render with user set
     }
  } else if (!user) {
    return <LoginPage />;
  }

  // Ensure bypass test can write
  const actualIsReadOnly = isTestBypass ? false : isReadOnly;

  // Voice assistant button — rendered inside the chat header (Home embed + floating launcher).
  const liveAssistantButton = (
    <LiveAssistant
      currentWeekData={currentWeekData}
      lessonPlans={lessonPlans}
      globalTasks={globalTasks}
      projects={projects}
      categories={categories}
      ideas={ideas}
      routineTasks={routineTasks}
      apps={apps}
      appCategories={appCategories}
      isAdmin={isAdmin}
      onUpdateLesson={handleSaveLesson}
      onAddRecurringLesson={handleBatchSaveLessons}
      onSaveTask={async (task) => {
        await saveTask(task);
        setGlobalTasks(prev => {
          const exists = prev.find(t => t.id === task.id);
          if (exists) return prev.map(t => t.id === task.id ? task : t);
          return [...prev, task];
        });
      }}
      onSaveProject={async (project) => {
        await saveProject(project);
        setProjects(prev => {
          const exists = prev.find(p => p.id === project.id);
          if (exists) return prev.map(p => p.id === project.id ? project : p);
          return [...prev, project];
        });
      }}
      onStatusChange={(active, statusText) => {
        setIsLiveActive(active);
        if (statusText) setLiveStatusText(statusText);
      }}
    />
  );

  // Quick-add "+" FAB (with the contextual "Undo AI Update" pill). Shown on every screen.
  const quickAddFab = (
    <div className="flex flex-col gap-2 items-end">
      {aiActionHistory.length > 0 && (
        <button
          onClick={handleUndoLastAiAction}
          className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs px-3 py-1.5 rounded-full font-bold shadow-sm hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors flex items-center gap-1 mb-1"
        >
          <ChevronLeft size={12} /> Undo AI Update
        </button>
      )}
      <button
        onClick={() => setIsQuickAddOpen(true)}
        className="group relative w-12 h-12 rounded-full shadow-md flex items-center justify-center transition-all duration-300 transform active:scale-95 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:shadow-green-500/20"
        aria-label="Quick add task"
      >
        <Plus size={24} />
        <span className="absolute right-14 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Quick Add
        </span>
      </button>
    </div>
  );

  // Open an app shortcut in a new tab (used by sidebar favourites + Home grid).
  const openApp = (app: AppItem) => { window.open(app.url, '_blank', 'noopener,noreferrer'); };
  const favouriteApps = apps.filter(a => a.isFavourite);

  // Apps are owned here (single source of truth) so favourites reflect in the sidebar + Home.
  const handleSaveApp = async (app: AppItem) => {
    if (actualIsReadOnly) return;
    setApps(prev => {
      const exists = prev.find(a => a.id === app.id);
      return exists ? prev.map(a => a.id === app.id ? app : a) : [app, ...prev];
    });
    try { await saveApp(app); } catch (e) { console.error('Failed to save app', e); }
  };
  const handleDeleteApp = async (id: string) => {
    if (actualIsReadOnly) return;
    if (!window.confirm('Are you sure you want to delete this app?')) return;
    setApps(prev => prev.filter(a => a.id !== id));
    try { await deleteApp(id); } catch (e) { console.error('Failed to delete app', e); }
  };
  const refreshAppCategories = async () => {
    try { setAppCategories(await fetchAppCategories()); } catch (e) { console.error(e); }
  };
  const refreshTasks = async () => {
    try { setGlobalTasks(await fetchTasks()); } catch (e) { console.error(e); }
  };

  // Shared chat props for the embedded Home chat and the floating launcher (one conversation).
  const chatBag = {
    messages: chatMessages,
    onSendMessage: handleAiSendMessage,
    isLoading: isAiLoading,
    pendingConfirmation: pendingActions,
    onConfirmActions: handleConfirmActions,
    onCancelActions: handleCancelActions,
    liveAssistantButton: liveAssistantButton,
    ...chatConv,
  };

  // Global search — surfaced in the top bar on every screen.
  const globalSearchEl = (
    <GlobalSearch
      globalTasks={globalTasks}
      projects={projects}
      lessonPlans={lessonPlans}
      onTaskSelect={(task) => {
        openTaskModal(task);
      }}
      onProjectSelect={(project) => {
        setActiveTab('projects');
        setSelectedProjectId(project.id);
      }}
      onLessonSelect={(lesson) => {
        setActiveTab('timetable');
        const d = new Date(lesson.dateStr);
        const weekIdx = weeksInTerm.findIndex(w => {
          const end = addDays(w.startDate, 7);
          return d >= w.startDate && d < end;
        });
        if (weekIdx !== -1) setSelectedWeekIndex(weekIdx);
        openLessonModal(lesson.dateStr, lesson.periodLabel, lesson.title || 'Lesson');
      }}
    />
  );

  // Timetable-only toolbar (term selector, class filter, week navigator).
  const timetableToolbarEl = (
    <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 lg:gap-3 bg-gray-100 dark:bg-slate-900 p-1.5 rounded-xl border border-gray-300 dark:border-slate-700 shadow-sm overflow-x-auto no-scrollbar">
      {/* Term Selector */}
      <div className="relative group shrink-0">
        <select
          className="appearance-none bg-white dark:bg-slate-800 text-slate-800 dark:text-white pl-4 pr-10 py-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm font-medium cursor-pointer transition-colors shadow-sm"
          value={selectedTermId}
          onChange={handleTermChange}
        >
          {terms.map(term => (
            <option key={term.id} value={term.id}>{term.name}</option>
          ))}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
      </div>

      {/* Class Filter */}
      <div className="relative group border-l border-gray-300 dark:border-slate-700 pl-2 lg:pl-3 ml-0.5 lg:ml-1 shrink-0">
        <div className="absolute left-5 lg:left-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-slate-400">
          <Filter size={14} />
        </div>
        <select
          className="appearance-none bg-white dark:bg-slate-800 text-slate-800 dark:text-white pl-8 lg:pl-9 pr-7 lg:pr-8 py-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm font-medium cursor-pointer transition-colors max-w-[120px] lg:max-w-[150px] truncate shadow-sm"
          value={viewFilter}
          onChange={(e) => setViewFilter(e.target.value)}
        >
          <option value="All">All Classes</option>
          {uniqueSubjects.map(subj => (
            <option key={subj} value={subj}>{subj}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
      </div>

      {/* Week Navigator */}
      <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-600 shadow-sm shrink-0 ml-1">
        <button
          onClick={handlePrevWeek}
          disabled={selectedWeekIndex === 0}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-l-lg"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="px-4 py-2 min-w-[140px] text-center border-l border-r border-gray-300 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors" onClick={handleJumpToCurrent} title="Jump to current week">
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
            {currentWeekData ? `Week ${currentWeekData.weekNumber}` : 'Loading...'}
          </div>
          <div className="text-sm font-bold text-slate-800 dark:text-white whitespace-nowrap">
            {currentWeekData?.displayString}
          </div>
        </div>
        <button
          onClick={handleNextWeek}
          disabled={selectedWeekIndex >= weeksInTerm.length - 1}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-r-lg"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <AppShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        favouriteApps={favouriteApps}
        onOpenApp={openApp}
        academicYears={academicYears}
        selectedAcademicYearId={selectedAcademicYearId}
        onAcademicYearChange={setSelectedAcademicYearId}
        isReadOnly={isReadOnly}
        isAdmin={isAdmin}
        user={user}
        theme={theme}
        themeIcon={getThemeIcon()}
        onCycleTheme={cycleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCalendar={() => setIsCalendarOpen(true)}
        onExport={exportData}
        onLogout={() => signOut(auth)}
        search={globalSearchEl}
        topBar={activeTab === 'timetable' ? timetableToolbarEl : undefined}
      >
          {activeTab === 'home' ? (
            <HomePage
              chat={chatBag}
              todaysLessons={todaysLessons}
              upcomingKeyDates={upcomingKeyDates}
              globalTasks={globalTasks}
              favouriteApps={favouriteApps}
              onOpenApp={openApp}
              onNavigate={setActiveTab}
              isReadOnly={actualIsReadOnly}
              onTasksRefresh={refreshTasks}
              userName={user?.displayName || undefined}
            />
          ) : activeTab === 'timetable' ? (
            <div className="min-w-[1600px] mx-auto md:p-8 p-4">
            
                {/* Grid Header - Sticky Top */}
                <div className="grid grid-cols-9 gap-4 sticky top-0 z-30 bg-gray-50/95 dark:bg-slate-950/95 backdrop-blur-sm py-2 pb-4 border-b border-gray-200/50 dark:border-slate-800/50">
                    {/* Top Left Corner - Sticky Left & Top */}
                    <div className="col-span-1 flex items-end pb-2 sticky left-0 z-40 bg-gray-50 dark:bg-slate-950">
                        <span className="text-2xl font-bold text-slate-400 dark:text-slate-500">Timetable</span>
                    </div>
                    {PERIOD_LABELS.map((label) => (
                    <div key={label} className="col-span-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-3 text-center transition-colors">
                        <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide text-sm">{label}</span>
                    </div>
                    ))}
                </div>

                {/* Grid Body */}
                <div className="space-y-4">
                    {isDataLoading && Object.keys(lessonPlans).length === 0 ? (
                    <div className="py-20 text-center col-span-9 flex flex-col items-center justify-center text-slate-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
                        <p>Loading your planner...</p>
                    </div>
                    ) : DAYS.map((day, dayIndex) => {
                    if (!currentWeekData) return null;
                    
                    // Determine which static timetable to use (Week 1 or Week 2)
                    const timetable = currentWeekData.weekNumber === 1 ? timetableWeek1 : timetableWeek2;
                    const daySchedule = timetable[day] || {};
                    
                    // Calculate specific date for this row
                    const rowDate = addDays(currentWeekData.startDate, dayIndex);
                    const dateStr = toISODate(rowDate);

                    return (
                        <div key={day} className="grid grid-cols-9 gap-4 group">
                        
                        {/* Day Label & Daily Tasks Column - Sticky Left */}
                        <div className="col-span-1 sticky left-0 z-20 flex flex-col bg-slate-200 dark:bg-slate-900 rounded-lg p-3 border border-slate-300 dark:border-slate-800 shadow-sm transition-colors group-hover:bg-slate-300 dark:group-hover:bg-slate-800 dark:group-hover:border-slate-700 h-full overflow-hidden">
                            <div className="flex flex-col justify-center text-center pb-2 mb-2 border-b border-slate-300 dark:border-slate-700 shrink-0">
                                <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{day}</span>
                                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">{formatDate(rowDate)}</span>
                            </div>

                            {/* Daily Tasks List */}
                            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 mt-1 pb-1">
                                {(() => {
                                    const allTasksAndSubtasks = globalTasks.flatMap(task => [
                                        task,
                                        ...(task.subtasks || []).map(st => ({
                                            ...st,
                                            _isSubtaskDisplay: true,
                                            _parentTaskId: task.id,
                                            _parentTaskTitle: task.title,
                                            projectId: task.projectId, // inherit project for color
                                            scheduledDateStr: st.scheduledDateStr || task.scheduledDateStr, // inherit dates
                                            deadlineDateStr: st.deadlineDateStr || task.deadlineDateStr,
                                            priority: st.priority || task.priority // inherit priority
                                        } as Task))
                                    ]);

                                    const dailyTasks = allTasksAndSubtasks.filter(t => t.scheduledDateStr === dateStr || t.deadlineDateStr === dateStr);

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
                                    const totalActive = activeRoutines.length + activeDailyTasks.length;
                                    const totalTasks = totalActive + totalCompleted;

                                    if (totalTasks === 0) return null;

                                    const progressPercentage = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

                                    // Default active tasks to be expanded, unless explicitly set to false
                                    const isExpandedActive = expandedActiveDays[dateStr] !== false;

                                    return (
                                        <>
                                        {/* Progress Bar Header */}
                                        <div className="mb-2 w-full">
                                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium mb-1">
                                                <span>{totalCompleted}/{totalTasks} Completed</span>
                                                <span>{progressPercentage}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500 rounded-full transition-all duration-300 ease-out"
                                                    style={{ width: `${progressPercentage}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Active Tasks Dropdown */}
                                        {totalActive > 0 && (
                                            <div className="mb-2">
                                                <button
                                                    onClick={() => setExpandedActiveDays(prev => ({...prev, [dateStr]: !isExpandedActive}))}
                                                    className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-1.5"
                                                >
                                                    <span>To Do ({totalActive})</span>
                                                    {isExpandedActive ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                </button>

                                                {isExpandedActive && (
                                                    <div className="space-y-1.5">
                                                        {activeRoutines.map(task => (
                                            <div key={task.id}
                                                 className={`flex items-start gap-1.5 bg-green-50/50 dark:bg-green-900/10 p-1.5 rounded border border-green-200/50 dark:border-green-800/50 shadow-sm text-xs relative group/dailytask cursor-pointer hover:shadow-md transition-shadow`}>
                                                <button
                                                    onClick={(e) => handleToggleRoutineTask(e, task, dateStr)}
                                                    className={`mt-0.5 shrink-0 text-slate-300 dark:text-slate-600 hover:text-green-500`}
                                                >
                                                    <Circle size={12} />
                                                </button>
                                                <div className="flex-1 flex flex-col min-w-0 pt-0.5">
                                                    <span className={`font-medium line-clamp-2 leading-tight text-slate-700 dark:text-slate-200`}>
                                                        {task.title}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}

                                        {activeDailyTasks.map(task => {
                                            const project = projects.find(p => p.id === task.projectId);
                                            const bgColorClass = project?.colorClass || 'bg-white dark:bg-slate-800';
                                            const textColorClass = project?.colorClass ? getContrastTextColor(project.colorClass) : 'text-slate-700 dark:text-slate-200';
                                            const isScheduled = task.scheduledDateStr === dateStr;
                                            const isDue = task.deadlineDateStr === dateStr;

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
                                                     className={`flex items-start gap-1.5 ${bgColorClass} p-1.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm text-xs relative group/dailytask cursor-pointer hover:shadow-md transition-shadow`}>
                                                    <button
                                                        onClick={(e) => toggleTaskCompletion(e, task.id, task._parentTaskId)}
                                                        className={`mt-0.5 shrink-0 ${task.status === 'In Progress' ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                                                    >
                                                        {task.status === 'In Progress' ? <Clock size={12} /> : <Circle size={12} />}
                                                    </button>
                                                    <div className="flex-1 flex flex-col min-w-0 pt-0.5">
                                                        {task._isSubtaskDisplay && (
                                                            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 mb-0.5 truncate">
                                                                ↳ {task._parentTaskTitle}
                                                            </span>
                                                        )}
                                                        <span className={`font-medium line-clamp-2 leading-tight ${task.status === 'In Progress' ? 'text-amber-700 dark:text-amber-500' : textColorClass}`}>
                                                            {task.title}
                                                        </span>
                                                        <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${project?.colorClass ? textColorClass + ' opacity-80' : 'text-slate-500 dark:text-slate-400'}`}>
                                                            {isScheduled && <span className="flex items-center gap-0.5" title="Scheduled today"><CalendarDays size={10} className={project?.colorClass ? '' : 'text-green-600 dark:text-green-400'} /> Sch</span>}
                                                            {isDue && <span className="flex items-center gap-0.5" title="Due today"><Clock size={10} className={project?.colorClass ? '' : 'text-red-600 dark:text-red-400'} /> Due</span>}
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
                                            <div className="mt-2 pt-2 border-t border-slate-300 dark:border-slate-700/50">
                                                <button
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
                                                                    className={`mt-0.5 shrink-0 text-green-500`}
                                                                >
                                                                    <CheckCircle2 size={12} />
                                                                </button>
                                                                <div className="flex-1 flex flex-col min-w-0 pt-0.5">
                                                                    {task._isSubtaskDisplay && (
                                                                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 mb-0.5 truncate">
                                                                            ↳ {task._parentTaskTitle}
                                                                        </span>
                                                                    )}
                                                                    <span className={`font-medium line-clamp-2 leading-tight line-through text-slate-500`}>
                                                                        {task.title}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Period Columns */}
                        {PERIOD_LABELS.map((period) => {
                            const entry = daySchedule[period];
                            const lessonKey = getLessonKey(dateStr, period);
                            const plan = lessonPlans[lessonKey];
                            // hasPlan if there's a title, notes, OR any links
                            const hasPlan = plan && (plan.title || (plan.links && plan.links.length > 0) || plan.notes);
                            const isMeeting = plan?.type === 'meeting';

                            // Determine Visibility based on Filter
                            const isVisible = viewFilter === 'All' || (entry?.subject === viewFilter);

                            if (!isVisible) {
                                return (
                                   <div 
                                      key={period} 
                                      className="col-span-1 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-gray-200 dark:border-slate-800 opacity-40 min-h-[140px]" 
                                   />
                                );
                            }

                            return (
                            <div 
                                key={period} 
                                className={`col-span-1 relative flex flex-col rounded-lg border shadow-sm transition-all duration-200 
                                ${getEntryClassName(entry)}
                                ${!entry ? 'opacity-60' : 'hover:shadow-md hover:scale-[1.01] cursor-pointer'}
                                ${isMeeting ? 'border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-400/30' : ''}
                                min-h-[140px]
                                `}
                                style={getEntryStyle(entry)}
                                onClick={() => {
                                // Allow viewing even if it's a free period
                                openLessonModal(dateStr, period, entry ? entry.subject : 'Free Period');
                                }}
                            >
                                {/* Static Timetable Content */}
                                <div className={`p-3 border-b border-black/5 dark:border-white/10 ${isMeeting ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                                    {entry ? (
                                        <p className="font-bold text-sm leading-tight">{entry.subject}</p>
                                    ) : (
                                        <p className="text-xs text-gray-400 dark:text-slate-500 text-center uppercase mt-1">Free / Admin</p>
                                    )}
                                </div>

                                {/* Dynamic Lesson Plan Content */}
                                <div className="flex-1 p-3 flex flex-col justify-between">
                                    {hasPlan ? (
                                        <>
                                            <div className="space-y-1">
                                                {isMeeting && (
                                                <div className="flex items-center gap-1.5 mb-1.5">
                                                    <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide flex items-center gap-1">
                                                    <Users size={10} /> Meeting
                                                    </span>
                                                </div>
                                                )}
                                                <p className={`text-sm font-medium line-clamp-3 ${plan.completed ? 'line-through text-opacity-50' : ''} dark:text-slate-200`}>
                                                    {plan.title || <span className="italic text-gray-500 dark:text-slate-400 font-normal">No title...</span>}
                                                </p>
                                                
                                                {plan.links && plan.links.length > 0 && (
                                                    <div className="flex flex-col gap-0.5 mt-1">
                                                        {plan.links.map((link, i) => (
                                                        <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400 hover:underline" onClick={(e) => e.stopPropagation()}>
                                                            <LinkIcon size={10} />
                                                            <span className="truncate max-w-[120px]">Link {i+1}</span>
                                                        </a>
                                                        ))}
                                                    </div>
                                                )}

                                                {plan.notes && (
                                                    <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                                        {plan.notes}
                                                    </div>
                                                )}
                                            </div>
                                            {!isReadOnly && (
                                                <div className="flex justify-end mt-2 pt-2 border-t border-black/5 dark:border-white/10">
                                                    <button 
                                                        onClick={(e) => toggleCompletion(e, dateStr, period)}
                                                        className={`p-1 rounded-full transition-colors ${plan.completed ? 'text-green-600 bg-green-100 dark:bg-green-900/50 dark:text-green-300' : 'text-gray-400 hover:text-green-600 hover:bg-white dark:hover:bg-slate-700 dark:hover:text-green-400'}`}
                                                        title="Mark as complete"
                                                    >
                                                        <CheckCircle2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-xs font-medium text-black/30 dark:text-white/30 flex items-center gap-1">
                                                <Calendar size={12} /> {isReadOnly ? 'View' : 'Plan'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                        </div>
                    );
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

                        // Determine if we need to sweep holiday tasks
                        // To do this, we need to know the start of this week and the end of the PREVIOUS week in the planner
                        // If there is a gap > 3 days (weekend is 2 days), we had a break/holiday
                        let holidayStartDateStr = null;
                        let holidayEndDateStr = null;

                        if (selectedWeekIndex > 0) {
                            const prevWeekEnd = addDays(weeksInTerm[selectedWeekIndex - 1].startDate, 4); // Friday of prev week
                            const currentWeekStart = currentWeekData.startDate; // Monday of current week
                            const timeDiff = currentWeekStart.getTime() - prevWeekEnd.getTime();
                            const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));

                            if (daysDiff > 3) {
                                // There was a gap!
                                holidayStartDateStr = toISODate(addDays(prevWeekEnd, 1)); // Saturday after previous term
                                holidayEndDateStr = toISODate(addDays(currentWeekStart, -1)); // Sunday before current term starts
                            }
                        } else if (selectedWeekIndex === 0) {
                             // First week of the term. Let's see if there was a previous term.
                             const currentTermIdx = terms.findIndex(t => t.id === selectedTermId);
                             if (currentTermIdx > 0) {
                                 const prevTerm = terms[currentTermIdx - 1];
                                 holidayStartDateStr = toISODate(addDays(prevTerm.endDate, 1));
                                 holidayEndDateStr = toISODate(addDays(currentWeekData.startDate, -1));
                             }
                        }

                        const weekendTasks = allTasksAndSubtasks.filter(t => {
                            const isWeekend = t.scheduledDateStr === satDateStr || t.deadlineDateStr === satDateStr ||
                                              t.scheduledDateStr === sunDateStr || t.deadlineDateStr === sunDateStr;

                            let isHolidayBacklog = false;
                            if (holidayStartDateStr && holidayEndDateStr) {
                                if (t.scheduledDateStr && t.scheduledDateStr >= holidayStartDateStr && t.scheduledDateStr <= holidayEndDateStr) {
                                    isHolidayBacklog = true;
                                }
                                if (t.deadlineDateStr && t.deadlineDateStr >= holidayStartDateStr && t.deadlineDateStr <= holidayEndDateStr) {
                                    isHolidayBacklog = true;
                                }
                            }

                            return isWeekend || isHolidayBacklog;
                        });

                        // We also need to pass this state to the rendering block
                        const hasHolidayBacklog = holidayStartDateStr && holidayEndDateStr && weekendTasks.some(t => {
                            return (t.scheduledDateStr && t.scheduledDateStr >= holidayStartDateStr && t.scheduledDateStr <= holidayEndDateStr) ||
                                   (t.deadlineDateStr && t.deadlineDateStr >= holidayStartDateStr && t.deadlineDateStr <= holidayEndDateStr);
                        });

                        // Sort by priority: High > Medium > Low
                        const priorityWeight: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
                        weekendTasks.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

                        const activeWeekendTasks = weekendTasks.filter(t => t.status !== 'Completed');
                        const completedWeekendTasks = weekendTasks.filter(t => t.status === 'Completed');

                        const applicableRoutinesSat = routineTasks.filter(t => t.daysOfWeek?.includes(6));
                        const applicableRoutinesSun = routineTasks.filter(t => t.daysOfWeek?.includes(0));

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
                                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">
                                        {hasHolidayBacklog ? 'Weekend Tasks & Holiday Backlog' : 'Weekend Tasks'}
                                    </h3>
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
                                            style={{ width: `${progressPercentage}%` }}
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
                                                    <div key={`${task.id}_${idx}`}
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
                                                             className={`flex items-start gap-2 ${bgColorClass} p-2 rounded border border-slate-200 dark:border-slate-700 shadow-sm text-sm relative group/dailytask cursor-pointer hover:shadow-md transition-shadow`}>
                                                            <button
                                                                onClick={(e) => toggleTaskCompletion(e, task.id, task._parentTaskId)}
                                                                className={`mt-0.5 shrink-0 ${task.status === 'In Progress' ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                                                            >
                                                                {task.status === 'In Progress' ? <Clock size={14} /> : <Circle size={14} />}
                                                            </button>
                                                            <div className="flex-1 flex flex-col min-w-0">
                                                                {task._isSubtaskDisplay && (
                                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5 truncate">
                                                                        ↳ {task._parentTaskTitle}
                                                                    </span>
                                                                )}
                                                                <span className={`font-medium ${task.status === 'In Progress' ? 'text-amber-700 dark:text-amber-500' : textColorClass}`}>
                                                                    {task.title}
                                                                </span>
                                                                <div className={`flex items-center gap-2 mt-1 text-[11px] ${project?.colorClass ? textColorClass + ' opacity-80' : 'text-slate-500 dark:text-slate-400'}`}>
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
                                                    <div key={`${task.id}_${idx}`}
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
            </div>
          ) : activeTab === 'meetings' ? (
            <div className="max-w-7xl mx-auto md:p-8 p-4">
              <MeetingPlanner 
                initialWeekNumber={currentWeekData?.weekNumber || 1} 
                userTimetableWeek1={timetableWeek1}
                userTimetableWeek2={timetableWeek2}
              />
            </div>
          ) : activeTab === 'projects' ? (
            <ProjectPlanner
                isReadOnly={actualIsReadOnly}
                globalTasks={globalTasks}
                externalSelectedProjectId={selectedProjectId}
                onClearExternalProject={() => setSelectedProjectId(null)}
                onTaskUpdate={(updatedTask) => {
                    setGlobalTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                }}
                onTaskDelete={(taskId) => {
                    setGlobalTasks(prev => prev.filter(t => t.id !== taskId));
                }}
                onTaskAdd={(newTask) => {
                    setGlobalTasks(prev => [newTask, ...prev]);
                }}
                todaysLessons={todaysLessons}
                upcomingKeyDates={upcomingKeyDates}
            />
          ) : activeTab === 'keyDates' ? (
            <KeyDatesView
              keyDates={keyDates}
              categories={categories}
              onAddKeyDate={handleAddKeyDate}
              onEditKeyDate={handleEditKeyDate}
              onDeleteKeyDate={handleDeleteKeyDate}
            />
          ) : (
            <AppsHub
              isReadOnly={actualIsReadOnly}
              apps={apps}
              categories={appCategories}
              onSaveApp={handleSaveApp}
              onDeleteApp={handleDeleteApp}
              onRefreshCategories={refreshAppCategories}
            />
          )}
      </AppShell>

      <TaskEditModal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
        task={editingTask}
        categories={categories}
        onSave={handleEditTaskSave}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isReadOnly={actualIsReadOnly}
      />

      <TaskCardModal
        isOpen={isCardModalOpen}
        onClose={() => { setIsCardModalOpen(false); setCardTask(null); }}
        task={cardTask}
        projects={projects}
        categories={categories}
        isReadOnly={actualIsReadOnly}
        onEdit={(t) => { setIsCardModalOpen(false); openTaskModal(t); }}
        onTaskStatusChange={(t) => toggleTaskCompletion({ stopPropagation: () => {} } as any, t.id, t._parentTaskId)}
        onSubtaskStatusChange={(parentTask, subtaskId) => toggleTaskCompletion({ stopPropagation: () => {} } as any, subtaskId, parentTask.id)}
      />

      <LessonModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={getEditingLessonData()}
        onSave={handleSaveLesson}
        onBatchSave={handleBatchSaveLessons}
        onDelete={handleDeleteLesson}
        subjectName={editingSubjectName}
        weeksInTerm={weeksInTerm}
        currentWeekIndex={selectedWeekIndex}
        isReadOnly={isReadOnly}
        allLessonPlans={lessonPlans}
      />
      
      {isCalendarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <CalendarDays size={20} className="text-green-600 dark:text-green-400" />
                School Calendar
              </h2>
              <button 
                onClick={() => setIsCalendarOpen(false)} 
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 bg-white relative">
              <iframe 
                src="https://outlook.office365.com/owa/calendar/c4d9729873e4455aa6f874ce73e7cbaf@thamesview.kent.sch.uk/cba66eaff3b747aa8f6a37a9c9b8c03514736536730011714319/calendar.html"
                className="w-full h-full border-0"
                title="School Calendar"
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating chat + quick-add. Home embeds the chat, so there it only gets the quick-add FAB. */}
      {activeTab === 'home' ? (
        <div className="fixed bottom-6 right-6 z-50">{quickAddFab}</div>
      ) : (
        <ChatLauncher quickAddButton={quickAddFab} chat={chatBag} />
      )}

      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        categories={categories}
        projects={projects}
        onSaveTask={async (task) => {
          await saveTask(task);
          setGlobalTasks(prev => [task, ...prev]);
        }}
        onSaveIdea={async (idea) => {
          await saveIdea(idea);
          // Ideas state is maintained at ProjectPlanner / ProjectView level,
          // but saving it here works fine, they will re-fetch or optimistically update
        }}
      />
    </>
  );
};

export default App;
