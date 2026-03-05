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
  colorClass: string; // Tailwind class
}

// Maps Day (Mon-Fri) -> Period Label -> Entry
export interface WeeklyTimetable {
  [day: string]: {
    [period: string]: TimetableEntry | null;
  };
}

export interface Term {
  id: string;
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
