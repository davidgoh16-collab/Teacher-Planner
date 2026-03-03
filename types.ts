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
