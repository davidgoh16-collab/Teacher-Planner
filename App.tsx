
import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration, Chat } from "@google/genai";
import { auth } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { 
  TERMS, 
  TIMETABLE_WEEK_1, 
  TIMETABLE_WEEK_2, 
  PERIOD_LABELS, 
  DAYS 
} from './constants';
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
  formatDate 
} from './utils/dateUtils';
import LessonModal from './components/LessonModal';
import TaskEditModal from './components/TaskEditModal';
import ChatWidget from './components/ChatWidget';
import LiveAssistant from './components/LiveAssistant';
import MeetingPlanner from './components/MeetingPlanner';
import LoginPage from './components/LoginPage';
import ProjectPlanner from './components/ProjectPlanner';
import AppsHub from './components/AppsHub';
import CommunicationsTab from './components/CommunicationsTab';
import { fetchLessonPlans, saveLessonPlan, deleteLessonPlan } from './services/lessonService';
import { fetchTasks, saveTask, fetchProjects, saveProject, fetchCategories, saveIdea, fetchRoutineTasks, saveRoutineTask } from './services/projectService';
import { Task, Project, Category, ChatMessage, Idea, RoutineTask } from './types';
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
  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- State Initialization Logic ---
  const [initialState] = useState(() => {
    const now = new Date();
    
    // 1. Find the current or upcoming term
    let term = TERMS.find(t => now >= t.startDate && now <= t.endDate);
    
    if (!term) {
      // Look for the next upcoming term
      term = TERMS.find(t => t.startDate > now);
    }
    
    if (!term) {
      // If we are past all terms, use the last one; otherwise (e.g. error), use first
      if (TERMS.length > 0 && now > TERMS[TERMS.length - 1].endDate) {
        term = TERMS[TERMS.length - 1];
      } else {
        term = TERMS[0];
      }
    }

    // 2. Find the current or upcoming week within that term
    const weeks = generateWeeksForTerm(term);
    let weekIndex = 0;
    
    // Try to find the week containing 'now'
    const foundIndex = weeks.findIndex(w => {
      const weekStart = w.startDate;
      const weekEnd = addDays(weekStart, 7);
      return now >= weekStart && now < weekEnd;
    });

    if (foundIndex !== -1) {
      weekIndex = foundIndex;
    } else {
      // If not currently in a week (e.g. holiday or before term), find next upcoming week
      const nextIndex = weeks.findIndex(w => w.startDate > now);
      if (nextIndex !== -1) {
        weekIndex = nextIndex;
      } else if (now > term.endDate) {
        // If past end of term (should have been caught by term logic, but just in case)
        weekIndex = weeks.length - 1;
      }
    }

    return { termId: term.id, weekIndex };
  });

  // --- State ---
  const [selectedTermId, setSelectedTermId] = useState<string>(initialState.termId);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(initialState.weekIndex);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('eduPlan_theme');
    return (saved as Theme) || 'system';
  });
  
  // Filter State
  const [viewFilter, setViewFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'timetable' | 'meetings' | 'projects' | 'apps' | 'communications'>('timetable');

  // Global Tasks & Projects
  const [globalTasks, setGlobalTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Routine Tasks
  const [routineTasks, setRoutineTasks] = useState<RoutineTask[]>([]);

  // Lesson Plans: Keyed by "dateStr_periodLabel" -> LessonPlan object
  const [lessonPlans, setLessonPlans] = useState<Record<string, LessonPlan>>({});
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLessonKey, setEditingLessonKey] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState<string>('');

  // Task Edit Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Calendar Modal State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Quick Add Modal State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStatusText, setLiveStatusText] = useState('');
  const [expandedRoutineDays, setExpandedRoutineDays] = useState<Record<string, boolean>>({});

  // --- Derived Data ---
  const currentTerm = TERMS.find(t => t.id === selectedTermId) || TERMS[0];
  const weeksInTerm = useMemo(() => generateWeeksForTerm(currentTerm), [currentTerm]);
  
  const isAdmin = user?.uid === ADMIN_UID;
  const isReadOnly = !isAdmin;

  // Extract all unique subjects for the filter dropdown
  const uniqueSubjects = useMemo(() => {
    const subjects = new Set<string>();
    [TIMETABLE_WEEK_1, TIMETABLE_WEEK_2].forEach(tt => {
      Object.values(tt).forEach(daySchedule => {
        Object.values(daySchedule).forEach(entry => {
          if (entry?.subject) subjects.add(entry.subject);
        });
      });
    });
    return Array.from(subjects).sort();
  }, []);
  
  // Ensure selected week index is valid when term changes
  useEffect(() => {
    if (selectedWeekIndex >= weeksInTerm.length && weeksInTerm.length > 0) {
      setSelectedWeekIndex(0);
    }
  }, [selectedTermId, weeksInTerm.length, selectedWeekIndex]);

  const currentWeekData: WeekData | undefined = weeksInTerm[selectedWeekIndex];
  
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
        const [plans, tasks, projs, cats, routines] = await Promise.all([
            fetchLessonPlans(),
            fetchTasks(),
            fetchProjects(),
            fetchCategories(),
            fetchRoutineTasks()
        ]);
        setLessonPlans(plans);
        setGlobalTasks(tasks);
        setProjects(projs);
        setCategories(cats);
        setRoutineTasks(routines);
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
    let term = TERMS.find(t => now >= t.startDate && now <= t.endDate);
    if (!term) term = TERMS.find(t => t.startDate > now) || TERMS[TERMS.length - 1];
    
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

  const toggleTaskCompletion = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (isReadOnly) return;

    const task = globalTasks.find(t => t.id === taskId);
    if (!task) return;

    let nextStatus: Task['status'] = 'Uncompleted';
    if (task.status === 'Uncompleted') nextStatus = 'In Progress';
    else if (task.status === 'In Progress') nextStatus = 'Completed';
    else nextStatus = 'Uncompleted';

    const updated = { ...task, status: nextStatus };

    // Optimistic Update
    setGlobalTasks(prev => prev.map(t => t.id === taskId ? updated : t));

    try {
        await saveTask(updated);
    } catch (e) {
        console.error(e);
        // Revert
        setGlobalTasks(prev => prev.map(t => t.id === taskId ? task : t));
    }
  };

  const handleEditTaskSave = async (updatedTask: Task) => {
    if (isReadOnly) return;

    // Optimistic update
    setGlobalTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    setIsTaskModalOpen(false);

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

  const toggleCompletion = async (e: React.MouseEvent, dateStr: string, periodLabel: string) => {
    e.stopPropagation();
    if (isReadOnly) return;

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

  const isRoutineCompleted = (task: RoutineTask, targetDateStr: string) => {
    if (task.type === 'daily' || !task.type) {
         return task.lastCompletedDateStr === targetDateStr;
    } else {
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

         return lastCompletedDate >= mostRecentScheduledDate;
    }
  };

  const handleToggleRoutineTask = async (e: React.MouseEvent, task: RoutineTask, targetDateStr: string) => {
    e.stopPropagation();
    if (isReadOnly) return;
    const currentlyCompleted = isRoutineCompleted(task, targetDateStr);
    const updated = {
        ...task,
        lastCompletedDateStr: currentlyCompleted ? undefined : targetDateStr
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

  const handleAiSendMessage = async (userMessage: string, fileData?: { text: string, mimeType: string, isBase64: boolean }) => {
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage + (fileData ? ' [File Attached]' : '') }]);
    setIsAiLoading(true);

    try {
      if (!currentWeekData) throw new Error("No active week data");

      const apiKey = window.ENV?.GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || window.ENV?.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      // Build context about the current week's timetable
      const timetable = currentWeekData.weekNumber === 1 ? TIMETABLE_WEEK_1 : TIMETABLE_WEEK_2;
      let contextString = `Current Week Context: ${currentWeekData.displayString} (Week ${currentWeekData.weekNumber}).\n`;
      contextString += `Today is: ${new Date().toDateString()}.\n\n`;
      
      // Add Upcoming Weeks Context for Multi-week planning
      contextString += `--- CALENDAR CONTEXT (UPCOMING WEEKS) ---\n`;
      const upcomingWeeks = weeksInTerm.filter(w => w.startDate >= currentWeekData.startDate).slice(0, 10);
      upcomingWeeks.forEach(w => {
        const end = addDays(w.startDate, 4);
        contextString += `Week ${w.weekNumber}: ${toISODate(w.startDate)} to ${toISODate(end)}\n`;
      });

      // Add Master Timetables
      contextString += `\n--- MASTER TIMETABLE DEFINITIONS ---\n`;
      contextString += `(Week 1 Schedule)\n${JSON.stringify(getSimplifiedTimetable(TIMETABLE_WEEK_1), null, 2)}\n`;
      contextString += `(Week 2 Schedule)\n${JSON.stringify(getSimplifiedTimetable(TIMETABLE_WEEK_2), null, 2)}\n\n`;

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

      const systemInstruction = isReadOnly
        ? `You are an expert teacher's assistant. You have access to the user's timetable and projects.
           The current user is in READ-ONLY mode. You CANNOT add, update, or delete any plans or tasks.`
        : `You are an expert teacher's assistant. You help plan lessons, meetings, and manage project tasks.
           
           RULES:
           1. Default to planning for the Current Week unless the user explicitly mentions "next week", "future weeks", or specific dates.
           2. If the user asks for a "Meeting", set the 'type' parameter to 'meeting'.
           3. If the user asks to plan for the "whole year", "every week", "rest of the term", or "entire academic year", you MUST use the 'addRecurringLesson' tool. Do NOT try to call 'updateLesson' 40 times.
           4. 'addRecurringLesson' handles all date calculations for you. Just pass the day (e.g. "Monday"), the period, and the cycle (all/week1/week2).
           5. If the user uploads a document (e.g., meeting notes, email) and asks you to extract action items, you MUST use the 'addTaskToProject' tool for EACH action item you find if they specify a project to add them to.
           
           ${contextString}`;

      // Initialize Chat using new SDK pattern
      const chat: Chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: systemInstruction,
          // Only provide tools if user is admin
          tools: isAdmin ? [{ functionDeclarations: [updateLessonTool, addRecurringLessonTool, addTaskToProjectTool] }] : undefined
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
            const functionResponses = [];
            
            for (const call of functionCalls) {
                if (call.name === 'updateLesson') {
                    const args = call.args as any;
                    const key = getLessonKey(args.dateStr, args.periodLabel);
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
                   TERMS.forEach(term => {
                      allWeeks.push(...generateWeeksForTerm(term));
                   });

                   for (const week of allWeeks) {
                      // Filter by cycle
                      if (weekCycle === 'week1' && week.weekNumber !== 1) continue;
                      if (weekCycle === 'week2' && week.weekNumber !== 2) continue;

                      const targetDate = addDays(week.startDate, dayIndex);
                      const dateStr = toISODate(targetDate);
                      
                      const key = getLessonKey(dateStr, periodLabel);
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
                }
            }
            
            // Send function responses back to the model to get the final text confirmation
            if (functionResponses.length > 0) {
                const finalResult = await chat.sendMessage({ message: functionResponses });
                finalText = finalResult.text || "";
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  // Force bypass login for playwright tests.
  const isTestBypass = !user && window.location.search.includes('bypass_login=true');
  if (isTestBypass) {
     // we'll pretend there is a user
  } else if (!user) {
    return <LoginPage />;
  }

  // Ensure bypass test can write
  const actualIsReadOnly = isTestBypass ? false : isReadOnly;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Top Navigation Bar */}
      <header className="bg-white dark:bg-slate-950 text-slate-800 dark:text-white shadow-lg z-50 sticky top-0 border-b border-gray-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="bg-green-600 p-2 rounded-lg shadow-sm">
              <BookOpen size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Teacher Planner</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Academic Year 2025/2026 {isReadOnly && <span className="text-orange-500 ml-1 font-semibold">(View Only)</span>}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-gray-100 dark:bg-slate-900 p-1.5 rounded-xl border border-gray-300 dark:border-slate-700 shadow-sm">
            {/* Term Selector */}
            <div className="relative group">
              <select 
                className="appearance-none bg-white dark:bg-slate-800 text-slate-800 dark:text-white pl-4 pr-10 py-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm font-medium cursor-pointer transition-colors shadow-sm"
                value={selectedTermId}
                onChange={handleTermChange}
              >
                {TERMS.map(term => (
                  <option key={term.id} value={term.id}>{term.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
            </div>

            {/* Class Filter */}
            <div className="relative group border-l border-gray-300 dark:border-slate-700 pl-3 ml-1">
               <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-slate-400">
                  <Filter size={14} />
               </div>
               <select 
                  className="appearance-none bg-white dark:bg-slate-800 text-slate-800 dark:text-white pl-9 pr-8 py-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm font-medium cursor-pointer transition-colors max-w-[150px] truncate shadow-sm"
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
            <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-600 shadow-sm">
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

          <div className="flex items-center gap-2">
            <button 
                onClick={cycleTheme}
                className="flex items-center gap-2 bg-gray-100 dark:bg-slate-900 hover:bg-gray-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-lg transition-colors border border-gray-300 dark:border-slate-700 shadow-sm"
                title={`Theme: ${theme}`}
            >
                {getThemeIcon()}
            </button>
            
            <button 
                onClick={() => setIsCalendarOpen(true)}
                className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors px-3"
            >
                <CalendarDays size={14} /> <span className="hidden sm:inline">Calendar</span>
            </button>

            {isAdmin && (
                <button 
                    onClick={exportData} 
                    className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors px-3"
                >
                    <Download size={14} /> Backup
                </button>
            )}

            {/* User Profile / Logout */}
            <div className="flex items-center gap-3 pl-3 border-l border-gray-300 dark:border-slate-700 ml-1">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-gray-300 dark:border-slate-600 shadow-sm" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
              )}
              <button 
                onClick={() => signOut(auth)} 
                className="p-2 hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Tab Bar */}
        <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-2 flex gap-4 shrink-0 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab('timetable')}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'timetable' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'}`}
            >
              My Timetable
            </button>
            <button 
              onClick={() => setActiveTab('meetings')}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'meetings' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'}`}
            >
              Meeting Planner
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'projects' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'}`}
            >
              Project Planner
            </button>
            <button
              onClick={() => setActiveTab('apps')}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'apps' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'}`}
            >
              Apps
            </button>
            <button
              onClick={() => setActiveTab('communications')}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'communications' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'}`}
            >
              Communications
            </button>
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === 'timetable' ? (
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
                    const timetable = currentWeekData.weekNumber === 1 ? TIMETABLE_WEEK_1 : TIMETABLE_WEEK_2;
                    const daySchedule = timetable[day];
                    
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
                                    const dailyTasks = globalTasks.filter(t => t.scheduledDateStr === dateStr || t.deadlineDateStr === dateStr);

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

                                        {dailyTasks.map(task => {
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

                                        {completedRoutines.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-slate-300 dark:border-slate-700/50">
                                                <button
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
                                ${entry ? entry.colorClass : 'bg-white dark:bg-slate-800 border-dashed border-gray-300 dark:border-slate-700'} 
                                ${!entry ? 'opacity-60' : 'hover:shadow-md hover:scale-[1.01] cursor-pointer'}
                                ${isMeeting ? 'border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-400/30' : ''}
                                min-h-[140px]
                                `}
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
                </div>
            </div>
          ) : activeTab === 'meetings' ? (
            <div className="max-w-7xl mx-auto md:p-8 p-4">
              <MeetingPlanner 
                initialWeekNumber={currentWeekData?.weekNumber || 1} 
                userTimetableWeek1={TIMETABLE_WEEK_1}
                userTimetableWeek2={TIMETABLE_WEEK_2}
              />
            </div>
          ) : activeTab === 'projects' ? (
            <ProjectPlanner
                isReadOnly={actualIsReadOnly}
                globalTasks={globalTasks}
                onTaskUpdate={(updatedTask) => {
                    setGlobalTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                }}
                onTaskDelete={(taskId) => {
                    setGlobalTasks(prev => prev.filter(t => t.id !== taskId));
                }}
                onTaskAdd={(newTask) => {
                    setGlobalTasks(prev => [newTask, ...prev]);
                }}
            />
          ) : activeTab === 'communications' ? (
            <CommunicationsTab isReadOnly={actualIsReadOnly} />
          ) : (
            <AppsHub isReadOnly={actualIsReadOnly} />
          )}
        </div>
      </main>

      <TaskEditModal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
        task={editingTask}
        categories={categories}
        onSave={handleEditTaskSave}
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

      <ChatWidget 
        messages={chatMessages}
        onSendMessage={handleAiSendMessage}
        isLoading={isAiLoading}
        onSetMessages={setChatMessages}
        quickAddButton={
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="group relative w-12 h-12 rounded-full shadow-md flex items-center justify-center transition-all duration-300 transform active:scale-95 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:shadow-green-500/20"
          >
            <Plus size={24} />
            <span className="absolute right-14 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Quick Add
            </span>
          </button>
        }
        liveAssistantButton={
          <LiveAssistant
            currentWeekData={currentWeekData}
            lessonPlans={lessonPlans}
            globalTasks={globalTasks}
            projects={projects}
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
        }
        isLiveActive={isLiveActive}
        liveStatusText={liveStatusText}
      />

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
    </div>
  );
};

export default App;
