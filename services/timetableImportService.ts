import { WeeklyTimetable } from '../types';
import { parseTimetableImageWithName, parseTimetableTextWithName } from './aiService';
import { readFileContent } from '../utils/fileUtils';

/**
 * Batch timetable import for the meeting planner.
 *
 * Each uploaded file is normalised by readFileContent — images/PDFs go to the vision model as
 * inline data (images compressed first); Word/Excel/CSV/text are extracted to plain text and go
 * through the text parser. Either way the model extracts both the person's name and their
 * two-week timetable. The name falls back to a cleaned-up version of the filename when the
 * document doesn't print one, so a folder of "J Smith.pdf"-style exports still gets sensible
 * names. The caller reviews/edits the results before saving.
 */

/** The accept attribute shared by every timetable-import file input. */
export const TIMETABLE_ACCEPT = 'image/*,.pdf,.docx,.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt';

export interface ParsedImport {
  fileName: string;
  name: string;
  type: 'staff' | 'student';
  week1: WeeklyTimetable;
  week2: WeeklyTimetable;
  base64: string;
  mimeType: string;
  error?: string;
}

const compressIfImage = (base64: string, mimeType: string): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve) => {
    if (!mimeType.startsWith('image/')) { resolve({ base64, mimeType }); return; }
    const img = new Image();
    img.src = `data:${mimeType};base64,${base64}`;
    img.onload = () => {
      const MAX_WIDTH = 1024;
      let { width, height } = img;
      if (width > MAX_WIDTH) { height = (height * MAX_WIDTH) / width; width = MAX_WIDTH; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve({ base64, mimeType }); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve({ base64: canvas.toDataURL('image/jpeg', 0.7).split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = () => resolve({ base64, mimeType });
  });

/** Best-effort person name from a filename, used as a fallback / hint. */
export const nameFromFilename = (fileName: string): string => {
  const base = fileName.replace(/\.[^/.]+$/, '');               // drop extension
  const cleaned = base
    .replace(/[_\-]+/g, ' ')
    .replace(/\b(time ?table|schedule|week\s*\d+|wk\s*\d+|ww\d+|timetable|staff|student|copy|final|\d{4})\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const isEmptyTimetable = (tt: WeeklyTimetable | null | undefined): boolean =>
  !tt || Object.keys(tt).length === 0;

/** Process one file end-to-end into a reviewable ParsedImport. Never throws — errors are captured. */
export const importTimetableFile = async (file: File, type: 'staff' | 'student'): Promise<ParsedImport> => {
  const fallbackName = nameFromFilename(file.name) || file.name;
  try {
    const content = await readFileContent(file);
    let base64 = '';
    let mimeType = file.type;
    let result: { name: string | null; week1: WeeklyTimetable; week2: WeeklyTimetable };

    if (content.isBase64) {
      const compressed = await compressIfImage(content.text, content.mimeType);
      base64 = compressed.base64;
      mimeType = compressed.mimeType;
      result = await parseTimetableImageWithName(base64, mimeType, file.name);
    } else {
      result = await parseTimetableTextWithName(content.text, file.name);
    }

    const week1 = result.week1 || {};
    const week2 = result.week2 || {};
    const error = isEmptyTimetable(week1) && isEmptyTimetable(week2)
      ? 'No timetable detected in this file.'
      : undefined;

    return {
      fileName: file.name,
      name: (result.name && result.name.trim()) || fallbackName,
      type,
      week1,
      week2,
      base64,
      mimeType,
      error,
    };
  } catch (e: any) {
    console.error('Failed to import timetable file', file.name, e);
    return {
      fileName: file.name,
      name: fallbackName,
      type,
      week1: {},
      week2: {},
      base64: '',
      mimeType: file.type,
      error: e?.message?.includes('Unsupported file type') || e?.message?.includes("aren't supported")
        ? e.message
        : 'Could not read this file. Please try a clearer image or PDF.',
    };
  }
};
