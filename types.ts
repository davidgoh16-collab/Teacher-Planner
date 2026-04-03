declare global {
  interface Window {
    ENV?: {
      VITE_GEMINI_API_KEY?: string;
      GEMINI_API_KEY?: string;
    };
  }
}

export type WeekType = 1 | 2;

export interface LessonPlan {
  id: string;
  dateStr: string; // ISO date string YYYY-MM-DD
  periodLabel: string; // e.g., "Period 2"
  title: string;
  links: string[];
  notes: string;
  completed: boolean;
  type?: 'lesson' | 'meeting';
}

export interface TimetableEntry {
  subject: string;
  room?: string;
  colorClass: string; // Tailwind class OR HEX color
}

export interface AcademicYear {
  id: string;
  name: string; // e.g. "2025/2026"
  isDefault: boolean;
}

// Maps Day (Mon-Fri) -> Period Label -> Entry
export interface WeeklyTimetable {
  [day: string]: {
    [period: string]: TimetableEntry | null;
  };
}

export interface Term {
  id: string;
  academicYearId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  halfTermStart?: Date;
  halfTermEnd?: Date;
}

export interface WeekData {
  weekNumber: number; // 1 or 2
  startDate: Date;
  displayString: string; // "Sep 2 - Sep 5"
}

export interface Colleague {
  id: string;
  name: string;
  week1: WeeklyTimetable;
  week2: WeeklyTimetable;
  timetableImage?: string; // Base64 string
  timetableMimeType?: string; // e.g. "image/png" or "application/pdf"
}

export interface Category {
  id: string;
  name: string;
  colorClass: string; // Tailwind class
  type: 'project' | 'task';
}

export interface ProjectLink {
  url: string;
  displayName: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'Uncompleted' | 'In Progress' | 'Completed';
  priority: 'High' | 'Medium' | 'Low';
  categoryId?: string; // References a Category id
  scheduledDateStr?: string; // YYYY-MM-DD
  deadlineDateStr?: string; // YYYY-MM-DD
  assignedPeriodLabel?: string; // Optional: e.g. "Period 2" for timetable integration
  subtasks?: Task[]; // Nested subtasks
  aiGeneratedContent?: string;
  createdAt?: number;
  completedAt?: number;
  recurrenceType?: 'daily' | 'weekly';
  recurrenceDays?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday

  // Client-side only properties for displaying subtasks in flat lists
  _isSubtaskDisplay?: boolean;
  _parentTaskId?: string;
  _parentTaskTitle?: string;
}

export interface Idea {
  id: string;
  text: string;
  projectId?: string; // If undefined, it's a global idea
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string; // Rich text / simple text area notes
  categoryId?: string; // References a Category id
  colorClass?: string; // For the customizable background
  links: ProjectLink[];
  tasks: Task[]; // Usually fetched separately, but good for typed responses
  createdAt: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AIConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface AppCategory {
  id: string;
  name: string;
  colorClass: string;
}

export interface AppItem {
  id: string;
  name: string;
  url: string;
  iconType: 'preset' | 'imageUrl';
  iconValue: string; // the lucide icon name or image url
  categoryId?: string;
  colorClass?: string;
  createdAt: number;
}

export interface KeyDate {
  id: string;
  title: string;
  dateStr: string; // YYYY-MM-DD
  time?: string; // e.g., "14:00"
  isAllDay?: boolean;
  notes?: string;
  categoryId?: string;
  colorClass?: string; // e.g. Tailwind class
  createdAt: number;
}

export interface RoutineTask {
  id: string;
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  type: 'daily' | 'weekly';
  daysOfWeek?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  lastCompletedDateStr?: string; // YYYY-MM-DD (legacy)
  completedDatesStr?: string[]; // Array of YYYY-MM-DD for preserving history in UI
  createdAt: number;
}

export interface CommunicationMessage {
  id: string;
  type: 'email' | 'message' | 'letter';
  audience: 'parent' | 'staff' | 'announcement';
  recipient: string;
  replyToText?: string;
  instructions: string;
  generatedContent: string;
  createdAt: number;
}
