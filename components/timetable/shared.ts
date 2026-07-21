import { TimetableEntry } from '../../types';

/** Display-only short labels. Canonical PERIOD_LABELS strings remain the data keys. */
export const SHORT_LABEL: Record<string, string> = {
  'Morning Mtg': 'AM',
  'Period 1': 'P1',
  'Period 2': 'P2',
  'Period 3': 'P3',
  'Break': 'Break',
  'Period 4': 'P4',
  'Period 5': 'P5',
  'Period 6': 'P6',
  'Afternoon Mtg': 'PM',
};

/** Rows rendered as thin strips in the desktop grid. */
export const COMPACT_PERIODS = new Set(['Morning Mtg', 'Break', 'Afternoon Mtg']);

/** Split "12A/TTE - RM 44" into main subject + room line. Prefers entry.room when set. */
export const splitSubject = (entry: TimetableEntry): { main: string; room: string | null } => {
  if (entry.room) return { main: entry.subject, room: entry.room };
  const idx = entry.subject.indexOf(' - ');
  if (idx > 0) return { main: entry.subject.slice(0, idx), room: entry.subject.slice(idx + 3) };
  return { main: entry.subject, room: null };
};
