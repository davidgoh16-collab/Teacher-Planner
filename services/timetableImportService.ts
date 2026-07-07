import { WeeklyTimetable } from '../types';
import { parseTimetableImageWithName, parseTimetableTextWithName } from './aiService';
import { readFileContent } from '../utils/fileUtils';
import { detectAndScrub } from '../utils/piiDetector';
import { buildMappingFromPeople, rehydrateDeep } from '../utils/pseudonymiser';

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Remove any of `names` (whole-word, case-insensitive) from every string in a nested structure. */
const redactNamesDeep = <T>(value: T, names: string[]): T => {
  const patterns = names
    .filter((n) => n && n.trim().length >= 2)
    .map((n) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(n.trim())}(?![\\p{L}\\p{N}])`, 'giu'));
  const walk = (v: any): any => {
    if (typeof v === 'string') { let s = v; for (const p of patterns) s = s.replace(p, ''); return s; }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o: any = {};
      for (const [k, val] of Object.entries(v)) o[k] = walk(val);
      return o;
    }
    return v;
  };
  return walk(value);
};

/** The first roster name (whole-word, case-insensitive) that appears in the extracted text. */
const findRosterNameInText = (text: string, rosterNames: string[]): string | null => {
  for (const n of rosterNames) {
    const name = (n || '').trim();
    if (name.length >= 3 && new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'iu').test(text)) {
      return name;
    }
  }
  return null;
};

/** True if the file will be sent to the vision model as a raw image (photo, or scanned PDF). */
export const isLikelyScan = (file: File): boolean =>
  file.type.startsWith('image/') || file.type === 'application/pdf' || /\.(png|jpe?g|webp|gif|pdf)$/i.test(file.name);

/** Consent gate for scanned/image documents that must be sent to Gemini as a raw image. */
export const confirmScanConsent = (count = 1): boolean =>
  typeof window === 'undefined' ? true : window.confirm(
    `${count > 1 ? `${count} of these files look` : 'This file looks'} like a scan or photo. Processing ` +
    'it sends the raw image to Google Gemini, including any names or personal details visible on it. Continue?'
  );

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

/**
 * Process one file end-to-end into a reviewable ParsedImport. Never throws — errors are captured.
 *
 * Data minimisation of the person's name:
 * - Text documents: names are detected & scrubbed LOCALLY (piiDetector) before anything reaches
 *   Gemini, and the person is identified by matching the colleague roster — Gemini is never asked
 *   to read a name. If no roster match is found, the name is left for the reviewer to fill in.
 * - Scanned images: the raw image is sent to the vision model (behind the caller's consent gate);
 *   the prompt keeps names out of the lesson fields and we redact any that leak as a backstop.
 */
export const importTimetableFile = async (
  file: File,
  type: 'staff' | 'student',
  rosterNames: string[] = [],
): Promise<ParsedImport> => {
  const fallbackName = nameFromFilename(file.name) || file.name;
  try {
    const content = await readFileContent(file);
    let base64 = '';
    let mimeType = file.type;
    let name = '';
    let week1: WeeklyTimetable = {};
    let week2: WeeklyTimetable = {};

    if (content.isBase64) {
      const compressed = await compressIfImage(content.text, content.mimeType);
      base64 = compressed.base64;
      mimeType = compressed.mimeType;
      const result = await parseTimetableImageWithName(base64, mimeType, file.name);
      name = (result.name && result.name.trim()) || fallbackName;
      // Backstop: strip the person's name (and any roster name) out of the lesson fields.
      const redactList = [name, ...rosterNames];
      week1 = redactNamesDeep(result.week1 || {}, redactList);
      week2 = redactNamesDeep(result.week2 || {}, redactList);
    } else {
      // Detect + scrub names locally so they never reach Gemini; identify the person from the roster.
      // Use the labelled/table pass (not aggressive title-case) so lesson subjects like
      // "Design Technology" aren't mistaken for names and stripped out of the schedule.
      const rosterMapping = buildMappingFromPeople(rosterNames.map((n) => ({ name: n })));
      const detected = detectAndScrub(content.text, [], rosterMapping);
      const foundName = findRosterNameInText(content.text, rosterNames);
      const result = await parseTimetableTextWithName(detected.scrubbedText, foundName || undefined);
      // Restore any tokens the model echoed back into the (name-free) lesson fields.
      week1 = rehydrateDeep(result.week1 || {}, detected.mapping);
      week2 = rehydrateDeep(result.week2 || {}, detected.mapping);
      name = foundName || fallbackName;
    }

    const error = isEmptyTimetable(week1) && isEmptyTimetable(week2)
      ? 'No timetable detected in this file.'
      : undefined;

    return {
      fileName: file.name,
      name,
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
