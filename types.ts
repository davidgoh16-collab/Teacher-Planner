declare global {
  interface Window {
    ENV?: {
      VITE_GEMINI_API_KEY?: string;
      GEMINI_API_KEY?: string;
      VITE_FIREBASE_API_KEY?: string;
      /** 'personal' | 'school' — lets one built image be deployed as either edition. */
      EDITION?: string;
      /** Full Firebase web config, so a deployment can target its own project. */
      FIREBASE_CONFIG?: Record<string, string>;
      MINT_CUSTOM_TOKEN_URL?: string;
      RESOURCES_BUCKET?: string;
    };
  }
}

export type WeekType = 1 | 2;

// Top-level navigable sections (left sidebar).
export type AppTab = 'home' | 'timetable' | 'meetings' | 'projects' | 'apps' | 'keyDates' | 'shared' | 'resources' | 'aiHub';

/** File types the Resources library knows how to store, preview and hand back to the agent. */
export type ResourceType = 'docx' | 'pptx' | 'xlsx' | 'pdf' | 'md' | 'html' | 'csv' | 'txt' | 'png' | 'jpg';

/**
 * Something the teacher made — a generated lesson plan, a PowerPoint the agent built, a research
 * report, or a file they uploaded. The bytes live in Cloud Storage; this is the index.
 */
export interface TeacherResource {
  id: string;
  name: string;
  type: ResourceType;
  mimeType: string;
  size: number;
  /** Path in the resources bucket: users/{uid}/resources/{id}/{fileName} */
  storagePath: string;
  source: 'agent' | 'research' | 'trigger' | 'upload';
  /** Where it came from, for "show me what this chat produced" and for cleanup. */
  conversationId?: string;
  interactionId?: string;
  agentId?: string;
  triggerId?: string;
  summary?: string;
  tags?: string[];
  /** Pinned resources are mounted into every new agent sandbox (the persistent workspace). */
  pinnedToWorkspace: boolean;
  /**
   * True when the file was produced inside the agent sandbox, which only ever sees pseudonymised
   * names. Such a file may contain Student_XXXX tokens and is rehydrated on download.
   */
  pseudonymised: boolean;
  createdAt: number;
  updatedAt: number;
}

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
  type: 'staff' | 'student'; // which tab they belong to in the meeting planner
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
  order?: number; // Manual sort position (set via drag-to-reorder)
  completed?: boolean; // Manual completion flag (moves project to Completed section)
  completedAt?: number; // Timestamp when marked complete
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  // Optional collapsed "thought process" trace (markdown) for agent-mode answers.
  thoughts?: string;
}

export interface AIConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  // Agent mode (Antigravity managed agent) session continuity.
  mode?: 'chat' | 'agent';
  agentInteractionId?: string;
  agentEnvironmentId?: string;
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
  isFavourite?: boolean; // pinned to Home + sidebar quick-launch
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


/**
 * A way of working the teacher has taught the AI — a lesson-plan format, a marking style, a
 * departmental proforma. Materialised into the sandbox as .agents/skills/<slug>/SKILL.md, where
 * the agent harness discovers it automatically.
 */
export interface TeacherSkill {
  id: string;
  name: string;
  /** Directory name in the sandbox. Lowercase, hyphenated. */
  slug: string;
  description: string;
  /** The SKILL.md body: how to do this thing, in the teacher's own words. */
  instructions: string;
  assets?: Array<{ name: string; storagePath: string; size: number; mimeType: string }>;
  enabled: boolean;
  /** How many times this skill has actually been used — via /slash-command or the agent's own report. */
  usageCount?: number;
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** School branding applied to everything the AI produces. */
export interface BrandKit {
  displayName?: string;
  logoStoragePath?: string;
  colors: { primary: string; secondary: string; accent: string; text: string };
  fonts: { heading: string; body: string };
  headerText?: string;
  footerText?: string;
  /** Master .docx/.pptx files the agent fills in rather than building from scratch. */
  templates: Array<{ id: string; name: string; type: 'docx' | 'pptx'; storagePath: string }>;
  updatedAt: number;
}

/** Models a custom agent may be pinned to. */
export type AgentModel = 'gemini-3.6-flash' | 'gemini-3.5-flash' | 'gemini-3.5-flash-lite';

/**
 * An assistant the teacher has defined — a department administrator, a parent-communications
 * writer. Stored here and materialised onto the base agent per run, rather than registered with
 * the provider: that keeps versioning, memory and portability in our hands.
 */
export interface CustomAgent {
  id: string;
  name: string;
  description: string;
  /** Standing instructions, prepended to every run of this agent. */
  instructions: string;
  model: AgentModel;
  maxTotalTokens?: number;
  tools: { plannerTools: boolean; codeExecution: boolean; googleSearch: boolean; urlContext: boolean };
  mcpServerIds: string[];
  skillIds: string[];
  /** Whether the teacher's planner data is included in this agent's context. */
  includePlannerContext: boolean;
  memoryEnabled: boolean;
  /**
   * What the agent has learned. Stored PSEUDONYMISED, exactly as the agent wrote it — it is
   * rehydrated only for display in the memory editor.
   */
  memory?: { content: string; updatedAt: number };
  /** When the teacher acknowledged the warning about what not to put in an agent. */
  sensitiveAckAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** An external tool server the agent can call (Model Context Protocol). */
export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  headers?: Record<string, string>;
  allowedTools?: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
