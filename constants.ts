import { Term, WeeklyTimetable } from './types';

export const PERIOD_LABELS = ['Morning Mtg', 'Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6', 'Afternoon Mtg'];
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Color palette mapping based on image analysis
// Added dark: classes for dark mode support
export const COLORS = {
  Y13_TT: 'bg-red-100 text-red-900 border-red-200 dark:bg-red-900/30 dark:text-red-100 dark:border-red-800',
  Y13_GEO: 'bg-green-100 text-green-900 border-green-200 dark:bg-green-900/30 dark:text-green-100 dark:border-green-800',
  Y12_TTE: 'bg-yellow-100 text-yellow-900 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-100 dark:border-yellow-800',
  Y11_GEO: 'bg-teal-100 text-teal-900 border-teal-200 dark:bg-teal-900/30 dark:text-teal-100 dark:border-teal-800',
  Y10_GEO: 'bg-orange-100 text-orange-900 border-orange-200 dark:bg-orange-900/30 dark:text-orange-100 dark:border-orange-800',
  Y7_GEO: 'bg-sky-200 text-sky-900 border-sky-300 dark:bg-sky-900/30 dark:text-sky-100 dark:border-sky-800',
  PPA: 'bg-gray-50 text-gray-500 border-gray-200 italic dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700',
  STUDY: 'bg-pink-50 text-pink-900 border-pink-200 dark:bg-pink-900/20 dark:text-pink-100 dark:border-pink-800',
  MEETING: 'bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-100 dark:border-indigo-800',
  COMBINED: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-100 dark:border-fuchsia-800',
  REG: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-800',
};

// INITIAL MIGRATION DATA
export const TERMS: Term[] = [
  {
    id: 'autumn',
    academicYearId: 'academic_year_2025_2026',
    name: 'Autumn Term 2025',
    startDate: new Date('2025-09-02'),
    endDate: new Date('2025-12-19'),
    halfTermStart: new Date('2025-10-20'),
    halfTermEnd: new Date('2025-10-31'),
  },
  {
    id: 'spring',
    academicYearId: 'academic_year_2025_2026',
    name: 'Spring Term 2026',
    startDate: new Date('2026-01-05'),
    endDate: new Date('2026-04-02'),
    halfTermStart: new Date('2026-02-16'),
    halfTermEnd: new Date('2026-02-20'),
  },
  {
    id: 'summer',
    academicYearId: 'academic_year_2025_2026',
    name: 'Summer Term 2026',
    startDate: new Date('2026-04-20'),
    endDate: new Date('2026-07-22'),
    halfTermStart: new Date('2026-05-25'),
    halfTermEnd: new Date('2026-05-29'),
  },
];

export const TIMETABLE_WEEK_1: WeeklyTimetable = {
  Monday: {
    'Morning Mtg': { subject: 'Staff Briefing', colorClass: COLORS.MEETING },
    'Period 1': { subject: '10M', colorClass: COLORS.REG },
    'Period 2': { subject: 'PPA', colorClass: COLORS.COMBINED },
    'Period 3': { subject: '12A/TTE - RM 44', colorClass: COLORS.Y12_TTE },
    'Period 4': null,
    'Period 5': { subject: '13A/TT1 - RM 44', colorClass: COLORS.Y13_TT },
    'Period 6': { subject: 'PPA', colorClass: COLORS.PPA },
    'Afternoon Mtg': null,
  },
  Tuesday: {
    'Morning Mtg': null,
    'Period 1': { subject: '10M', colorClass: COLORS.REG },
    'Period 2': { subject: '11C/Gg1 - RM 44', colorClass: COLORS.Y11_GEO },
    'Period 3': { subject: '12A/TTE - RM 44', colorClass: COLORS.Y12_TTE },
    'Period 4': { subject: '13A/TT1 - RM 44', colorClass: COLORS.Y13_TT },
    'Period 5': { subject: '13A/Gg1 - RM 44', colorClass: COLORS.Y13_GEO },
    'Period 6': { subject: 'PPA', colorClass: COLORS.COMBINED },
    'Afternoon Mtg': null,
  },
  Wednesday: {
    'Morning Mtg': null,
    'Period 1': { subject: '10M', colorClass: COLORS.REG },
    'Period 2': { subject: '10B/Gg1 - RM 44', colorClass: COLORS.Y10_GEO },
    'Period 3': { subject: '13A/TT1', colorClass: COLORS.Y13_TT },
    'Period 4': { subject: 'PPA', colorClass: COLORS.PPA },
    'Period 5': { subject: '7H/Geo - RM 44', colorClass: COLORS.Y7_GEO },
    'Period 6': { subject: '12A/TTE - RM 44', colorClass: COLORS.Y12_TTE },
    'Afternoon Mtg': null,
  },
  Thursday: {
    'Morning Mtg': null,
    'Period 1': { subject: '10M', colorClass: COLORS.REG },
    'Period 2': null,
    'Period 3': { subject: '11C/Gg1 - RM 44', colorClass: COLORS.Y11_GEO },
    'Period 4': { subject: '13A/TT1 - RM 44', colorClass: COLORS.Y13_TT },
    'Period 5': { subject: '10B/Gg1 - RM 44', colorClass: COLORS.Y10_GEO },
    'Period 6': { subject: '12A/TTE - RM 44', colorClass: COLORS.Y12_TTE },
    'Afternoon Mtg': null,
  },
  Friday: {
    'Morning Mtg': null,
    'Period 1': { subject: '10M', colorClass: COLORS.REG },
    'Period 2': { subject: '13A/Gg1 - RM 44', colorClass: COLORS.Y13_GEO },
    'Period 3': { subject: '10B/Gg1 - RM 44', colorClass: COLORS.Y10_GEO },
    'Period 4': { subject: '11C/Gg1 - RM 44', colorClass: COLORS.Y11_GEO },
    'Period 5': { subject: '12A/TTE - RM 44', colorClass: COLORS.Y12_TTE },
    'Period 6': { subject: '13A/TT1 - RM 44', colorClass: COLORS.Y13_TT },
    'Afternoon Mtg': null,
  },
};

export const TIMETABLE_WEEK_2: WeeklyTimetable = {
  Monday: {
    'Morning Mtg': { subject: 'Staff Briefing', colorClass: COLORS.MEETING },
    'Period 1': { subject: '10M', colorClass: COLORS.REG },
    'Period 2': null,
    'Period 3': { subject: '13A/Gg1 - RM 44', colorClass: COLORS.Y13_GEO },
    'Period 4': null,
    'Period 5': { subject: '12A/TTE - RM 44', colorClass: COLORS.Y12_TTE },
    'Period 6': { subject: '13A/TT1 - RM 44', colorClass: COLORS.Y13_TT },
    'Afternoon Mtg': null,
  },
  Tuesday: {
    'Morning Mtg': null,
    'Period 1': { subject: '10M', colorClass: COLORS.REG },
    'Period 2': { subject: 'PPA', colorClass: COLORS.COMBINED },
    'Period 3': { subject: '13A/Gg1 - RM 44', colorClass: COLORS.Y13_GEO },
    'Period 4': null,
    'Period 5': { subject: '12A/TTE - RM 44', colorClass: COLORS.Y12_TTE },
    'Period 6': { subject: '11C/Gg1 - RM 44', colorClass: COLORS.Y11_GEO },
    'Afternoon Mtg': null,
  },
  Wednesday: {
    'Morning Mtg': null,
    'Period 1': { subject: '10M', colorClass: COLORS.REG },
    'Period 2': { subject: '12A/TTE - RM 44', colorClass: COLORS.Y12_TTE },
    'Period 3': { subject: 'PPA', colorClass: COLORS.PPA },
    'Period 4': { subject: '13A/TT1 - RM 44', colorClass: COLORS.Y13_TT },
    'Period 5': { subject: 'PPA', colorClass: COLORS.PPA },
    'Period 6': { subject: '10B/Gg1 - RM 44', colorClass: COLORS.Y10_GEO },
    'Afternoon Mtg': null,
  },
  Thursday: {
    'Morning Mtg': null,
    'Period 1': { subject: '10M', colorClass: COLORS.REG },
    'Period 2': { subject: '13A/TT1 - RM 44', colorClass: COLORS.Y13_TT },
    'Period 3': { subject: '11C/Gg1 - RM 44', colorClass: COLORS.Y11_GEO },
    'Period 4': null,
    'Period 5': { subject: '12A/TTE - RM 44', colorClass: COLORS.Y12_TTE },
    'Period 6': { subject: '10B/Gg1 - RM 44', colorClass: COLORS.Y10_GEO },
    'Afternoon Mtg': null,
  },
  Friday: {
    'Morning Mtg': null,
    'Period 1': { subject: '10M', colorClass: COLORS.REG },
    'Period 2': { subject: '13A/Gg1 - RM 44', colorClass: COLORS.Y13_GEO },
    'Period 3': { subject: '13A/TT1 - RM 44', colorClass: COLORS.Y13_TT },
    'Period 4': { subject: '10B/Gg1 - RM 44', colorClass: COLORS.Y10_GEO },
    'Period 5': { subject: '11C/Gg1 - RM 44', colorClass: COLORS.Y11_GEO },
    'Period 6': null,
    'Afternoon Mtg': null,
  },
};