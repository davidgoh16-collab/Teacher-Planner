// Detects personal identifiers in extracted document text and returns a scrubbed
// copy (names -> Student_/Staff_ tokens, other identifiers masked) plus the
// mapping needed to rehydrate the model's response.

import { createMapping, addDetectedName, scrubText, PseudonymMapping } from './pseudonymiser';

const LABELLED_NAME = /\b(Full Name|First Name|Last Name|Forename|Surname|Student Name|Pupil Name|Candidate Name|Learner Name|Teacher Name|Staff Name|Key ?Worker|Name|Student|Pupil|Candidate|Learner|Teacher|Tutor|Staff|Signed|Marked By)[ \t]*[:\-][ \t]*([A-Z][\p{L}'’.\-]+(?:[ \t]+[A-Z][\p{L}'’.\-]+){0,3})/gu;
const COMMA_NAME = /\b([A-Z][\p{L}'’\-]{1,})[ \t]*,[ \t]*([A-Z][\p{L}'’\-]{1,})\b/gu;
const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;
const PHONE = /(?:\+44\s?\d{2,4}|\(?0\d{3,4}\)?)[\s-]?\d{3}[\s-]?\d{3,4}\b/g;
const DOB = /\b(?:DOB|Date of Birth|Birth ?Date|D\.O\.B\.?)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/gi;
const UPN = /\b[A-HJ-NP-Z]\d{12}\b/g;

const STUDENT_HEADER = /^(?:name|student|pupil|candidate|learner|forename|surname|full ?name|student ?name|pupil ?name|child|individual|young person)$/i;
const STAFF_HEADER = /^(?:teacher|staff|tutor|teacher ?name|staff ?name|key ?worker|member of staff)$/i;
const DOB_HEADER = /^(?:dob|d\.?o\.?b\.?|date of birth|birth ?date)$/i;

const STAFF_LABELS = new Set(['teacher', 'staff', 'tutor', 'signed', 'marked by', 'teacher name', 'staff name', 'key worker', 'keyworker']);

const FIELD_LABELS = new Set([
    'year', 'form', 'class', 'dob', 'set', 'group', 'tutor', 'house', 'gender', 'upn',
    'target', 'grade', 'reg', 'date', 'sen', 'pp', 'email', 'tel', 'phone', 'address',
    'postcode', 'candidate', 'centre', 'center', 'subject', 'component', 'no', 'number', 'id',
]);

function trimTrailingLabels(name: string): string {
    const words = name.trim().split(/\s+/);
    const out: string[] = [];
    for (const w of words) {
        if (FIELD_LABELS.has(w.toLowerCase().replace(/[:.]+$/, ''))) break;
        out.push(w);
    }
    return out.join(' ');
}

function detectLabelled(text: string, mapping: PseudonymMapping): void {
    LABELLED_NAME.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LABELLED_NAME.exec(text)) !== null) {
        const label = (m[1] || '').trim().toLowerCase();
        const name = trimTrailingLabels((m[2] || '').trim());
        if (name) addDetectedName(mapping, name, STAFF_LABELS.has(label) ? 'staff' : 'student');
    }
    COMMA_NAME.lastIndex = 0;
    while ((m = COMMA_NAME.exec(text)) !== null) {
        const surname = (m[1] || '').trim();
        const forename = (m[2] || '').trim();
        if (surname && forename) addDetectedName(mapping, `${forename} ${surname}`);
    }
}

function detectTableFields(rows: string[][], mapping: PseudonymMapping, dobValues: string[]): void {
    if (!Array.isArray(rows) || rows.length === 0) return;
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;
        const cols: { c: number; kind: 'student' | 'staff' | 'dob' }[] = [];
        row.forEach((cell, c) => {
            const t = (cell || '').toString().trim();
            if (STUDENT_HEADER.test(t)) cols.push({ c, kind: 'student' });
            else if (STAFF_HEADER.test(t)) cols.push({ c, kind: 'staff' });
            else if (DOB_HEADER.test(t)) cols.push({ c, kind: 'dob' });
        });
        if (cols.length) {
            for (let rr = r + 1; rr < rows.length; rr++) {
                const dr = rows[rr];
                if (!Array.isArray(dr)) continue;
                for (const { c, kind } of cols) {
                    const val = (dr[c] || '').toString().trim();
                    if (!val) continue;
                    if (kind === 'dob') {
                        if (/\d/.test(val)) dobValues.push(val);
                    } else if (/[A-Za-z]/.test(val) && !STUDENT_HEADER.test(val) && !STAFF_HEADER.test(val) && !/^\d+$/.test(val)) {
                        addDetectedName(mapping, val, kind === 'staff' ? 'staff' : 'student');
                    }
                }
            }
            return;
        }
    }
}

const NAME_TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'sir', 'mx']);
const TITLECASE_STOP = new Set([
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'year', 'form', 'class', 'term', 'set', 'group', 'house', 'school', 'academy', 'college', 'street', 'road', 'avenue',
    'the', 'and', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'special', 'educational', 'needs', 'provision', 'plan',
    'review', 'record', 'outcome', 'support', 'education', 'health', 'care', 'local', 'authority', 'english', 'maths',
    'science', 'geography', 'history', 'department', 'report', 'behaviour', 'communication', 'event', 'incident',
]);
const TITLECASE_SEQ = /\b([A-Z][a-z'’.\-]+(?:[ \t]+[A-Z][a-z'’.\-]+){1,2})\b/g;

function detectTitleCaseNames(text: string, mapping: PseudonymMapping): void {
    TITLECASE_SEQ.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TITLECASE_SEQ.exec(text)) !== null) {
        const phrase = m[1].trim();
        const words = phrase.split(/\s+/).map((w) => w.toLowerCase().replace(/[.'’\-]+$/, ''));
        if (words.some((w) => TITLECASE_STOP.has(w) && !NAME_TITLES.has(w))) continue;
        addDetectedName(mapping, phrase);
    }
}

export function detectAndScrub(
    text: string,
    rows: string[][] = [],
    baseMapping?: PseudonymMapping,
    opts: { aggressiveNames?: boolean } = {}
): { scrubbedText: string; mapping: PseudonymMapping } {
    const mapping = baseMapping || createMapping();
    if (!text) return { scrubbedText: text || '', mapping };

    detectLabelled(text, mapping);
    const dobValues: string[] = [];
    detectTableFields(rows, mapping, dobValues);
    if (opts.aggressiveNames) detectTitleCaseNames(text, mapping);

    let out = text
        .replace(UPN, '[ID]')
        .replace(DOB, (full, d) => full.replace(d, '[DOB]'))
        .replace(POSTCODE, '[POSTCODE]')
        .replace(PHONE, '[PHONE]');
    for (const dv of dobValues) out = out.split(dv).join('[DOB]');

    out = scrubText(out, mapping);
    return { scrubbedText: out, mapping };
}
