// Application-side data minimisation: strips/pseudonymises personal identifiers
// (names, emails, admission/candidate numbers, uids) before any text is sent to
// the Gemini API, and rehydrates pseudonymous tokens back to real values for
// display/storage. The mapping never leaves the app process.
//
// Token spaces:
//   Student_XXXXXXXX / Staff_XXXXXXXX  -> a person's display name
//   Id_XXXXXXXX                        -> a non-name identifier (admNo, candidateNumber, ...)

export interface PseudonymMapping {
    tokenToUid: Map<string, string>;
    tokenToName: Map<string, string>;
    tokenToOriginal: Map<string, string>;
    uidToToken: Map<string, string>;
    nameToToken: Map<string, string>;
    scrubEntries: { value: string; token: string }[];
}

export interface Person {
    name: string;
    ids?: (string | number | null | undefined)[];
    role?: string;
}

export const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
export const TOKEN_REGEX = /(?:Student|Staff|Id)_[0-9A-F]{8}/gi;

// True if `s` is itself a prefix of a real token (Student_/Staff_/Id_ + up to 8 hex) —
// hold back ONLY a trailing partial token across chunks, never a word ending in s/i.
const MAX_TOKEN_LEN = 16;
const TOKEN_TEMPLATES = ['STUDENT_', 'STAFF_', 'ID_'];
function isTokenPrefix(s: string): boolean {
    if (!s) return false;
    const up = s.toUpperCase();
    for (const tpl of TOKEN_TEMPLATES) {
        if (tpl.startsWith(up)) return true;
        if (up.startsWith(tpl) && /^[0-9A-F]{0,8}$/.test(up.slice(tpl.length))) return true;
    }
    return false;
}

const NAME_STOPWORDS = new Set([
    'the', 'and', 'for', 'year', 'form', 'class', 'date', 'name', 'student',
    'pupil', 'grade', 'term', 'mrs', 'mr', 'ms', 'miss', 'dr', 'sir', 'set',
    'group', 'tutor', 'house', 'candidate', 'learner', 'target', 'subject',
]);

function fnv1a(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function hex8(n: number): string {
    return (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export function pseudonymForUid(uid: string, role?: 'student' | 'admin' | string, salt = 0): string {
    const prefix = role === 'admin' ? 'Staff' : 'Student';
    const input = salt === 0 ? uid : `${uid}#${salt}`;
    return `${prefix}_${hex8(fnv1a(input))}`;
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normaliseName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function createMapping(): PseudonymMapping {
    return {
        tokenToUid: new Map(),
        tokenToName: new Map(),
        tokenToOriginal: new Map(),
        uidToToken: new Map(),
        nameToToken: new Map(),
        scrubEntries: [],
    };
}

function addScrub(mapping: PseudonymMapping, value: string, token: string): void {
    if (!value) return;
    mapping.scrubEntries.push({ value, token });
}

function sortScrub(mapping: PseudonymMapping): void {
    mapping.scrubEntries.sort((a, b) => b.value.length - a.value.length);
}

function registerNameParts(mapping: PseudonymMapping, name: string, token: string, nameWordCounts: Map<string, number> | null): void {
    const words = name.split(/\s+/);
    if (words.length <= 1) return;
    const first = words[0];
    const last = words[words.length - 1];
    const unique = (w: string) => !nameWordCounts || nameWordCounts.get(w.toLowerCase()) === 1;
    addScrub(mapping, `${last}, ${first}`, token);
    if (first.length >= 3 && !NAME_STOPWORDS.has(first.toLowerCase()) && unique(first)) addScrub(mapping, first, token);
    if (last.length >= 3 && !NAME_STOPWORDS.has(last.toLowerCase()) && unique(last)) addScrub(mapping, last, token);
}

interface MappingUser {
    uid: string;
    displayName: string | null;
    email: string | null;
    role?: string;
}

export function buildMapping(users: MappingUser[]): PseudonymMapping {
    const m = createMapping();

    const nameWordCounts = new Map<string, number>();
    for (const u of users) {
        if (!u || !u.displayName) continue;
        for (const word of u.displayName.trim().split(/\s+/)) {
            if (word.length < 3) continue;
            const key = word.toLowerCase();
            nameWordCounts.set(key, (nameWordCounts.get(key) || 0) + 1);
        }
    }

    for (const u of users) {
        if (!u) continue;
        const role = u.role === 'admin' ? 'admin' : 'student';
        let token = pseudonymForUid(u.uid, role);
        let salt = 1;
        while (m.tokenToUid.has(token) && m.tokenToUid.get(token) !== u.uid) {
            token = pseudonymForUid(u.uid, role, salt++);
        }

        m.tokenToUid.set(token, u.uid);
        m.uidToToken.set(u.uid, token);

        if (u.displayName) {
            const trimmed = u.displayName.trim();
            m.tokenToName.set(token, trimmed);
            m.tokenToOriginal.set(token, trimmed);
            m.nameToToken.set(normaliseName(trimmed), token);
            if (trimmed.length >= 3) addScrub(m, trimmed, token);
            registerNameParts(m, trimmed, token, nameWordCounts);
        }
        if (u.email) addScrub(m, u.email, token);
    }

    sortScrub(m);
    return m;
}

export function buildSelfMapping(
    user: { uid: string; displayName: string | null; email: string | null; role?: string } | null
): PseudonymMapping {
    if (!user) return createMapping();
    return buildMapping([{ ...user, role: user.role || 'student' }]);
}

export function buildMappingFromPeople(people: Person[]): PseudonymMapping {
    const m = createMapping();

    const nameWordCounts = new Map<string, number>();
    for (const p of people) {
        if (!p || !p.name) continue;
        for (const word of p.name.trim().split(/\s+/)) {
            if (word.length < 3) continue;
            const key = word.toLowerCase();
            nameWordCounts.set(key, (nameWordCounts.get(key) || 0) + 1);
        }
    }

    for (const p of people) {
        if (!p || !p.name) continue;
        const name = p.name.trim();
        if (name.length >= 2) {
            const norm = normaliseName(name);
            let token = m.nameToToken.get(norm);
            if (!token) {
                const prefix = (p.role === 'admin' || p.role === 'staff') ? 'Staff' : 'Student';
                let salt = 0;
                token = `${prefix}_${hex8(fnv1a(norm))}`;
                while (m.tokenToName.has(token) && normaliseName(m.tokenToName.get(token)!) !== norm) {
                    token = `${prefix}_${hex8(fnv1a(`${norm}#${++salt}`))}`;
                }
                m.nameToToken.set(norm, token);
                m.tokenToName.set(token, name);
                m.tokenToOriginal.set(token, name);
                addScrub(m, name, token);
                registerNameParts(m, name, token, nameWordCounts);
            }
        }
        if (Array.isArray(p.ids)) {
            for (const rawId of p.ids) registerIdentifier(m, rawId);
        }
    }

    sortScrub(m);
    return m;
}

function registerIdentifier(mapping: PseudonymMapping, rawId: string | number | null | undefined): string | null {
    if (rawId === undefined || rawId === null) return null;
    const idStr = String(rawId).trim();
    if (idStr.length < 2) return null;
    const key = `#id#${idStr.toLowerCase()}`;
    const existing = mapping.nameToToken.get(key);
    if (existing) return existing;
    let salt = 0;
    let token = `Id_${hex8(fnv1a(`id:${idStr}`))}`;
    while (mapping.tokenToOriginal.has(token) && mapping.tokenToOriginal.get(token) !== idStr) {
        token = `Id_${hex8(fnv1a(`id:${idStr}#${++salt}`))}`;
    }
    mapping.nameToToken.set(key, token);
    mapping.tokenToOriginal.set(token, idStr);
    addScrub(mapping, idStr, token);
    return token;
}

export function addDetectedName(mapping: PseudonymMapping, name: string, role?: string): string | null {
    if (!name) return null;
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < 2) return null;
    const norm = normaliseName(clean);
    const existing = mapping.nameToToken.get(norm);
    if (existing) return existing;

    const prefix = (role === 'admin' || role === 'staff') ? 'Staff' : 'Student';
    let salt = 0;
    let token = `${prefix}_${hex8(fnv1a(norm))}`;
    while (mapping.tokenToName.has(token) && normaliseName(mapping.tokenToName.get(token)!) !== norm) {
        token = `${prefix}_${hex8(fnv1a(`${norm}#${++salt}`))}`;
    }
    mapping.nameToToken.set(norm, token);
    mapping.tokenToName.set(token, clean);
    mapping.tokenToOriginal.set(token, clean);
    addScrub(mapping, clean, token);
    registerNameParts(mapping, clean, token, null);
    sortScrub(mapping);
    return token;
}

export function registerIdentifierToken(mapping: PseudonymMapping, rawId: string | number): string | null {
    const token = registerIdentifier(mapping, rawId);
    if (token) sortScrub(mapping);
    return token;
}

export function scrubText(text: string, mapping?: PseudonymMapping): string {
    if (!text) return text;
    let result = text;
    if (mapping) {
        for (const { value, token } of mapping.scrubEntries) {
            const pattern = new RegExp(
                `(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`,
                'giu'
            );
            result = result.replace(pattern, token);
        }
    }
    result = result.replace(EMAIL_REGEX, '[EMAIL]');
    return result;
}

export function rehydrateText(text: string, mapping: PseudonymMapping): string {
    if (!text || !mapping) return text;
    return text.replace(TOKEN_REGEX, (match) => {
        const idx = match.indexOf('_');
        const prefix = match.slice(0, idx);
        const hex = match.slice(idx + 1).toUpperCase();
        const canonical = `${prefix.charAt(0).toUpperCase()}${prefix.slice(1).toLowerCase()}_${hex}`;
        const val = mapping.tokenToOriginal.get(canonical);
        if (val !== undefined) return val;
        const name = mapping.tokenToName.get(canonical);
        return name !== undefined ? name : match;
    });
}

export function rehydrateDeep<T = any>(value: T, mapping: PseudonymMapping): T {
    if (typeof value === 'string') return rehydrateText(value, mapping) as unknown as T;
    if (Array.isArray(value)) return value.map((v) => rehydrateDeep(v, mapping)) as unknown as T;
    if (value && typeof value === 'object') {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = (k === 'data' || k === 'inlineData') ? v : rehydrateDeep(v, mapping);
        }
        return out as unknown as T;
    }
    return value;
}

const BINARY_KEYS = new Set(['data', 'inlineData', 'fileBase64', 'imageBase64', 'base64Data', 'audioBase64']);

// Deep-scrub every string in a structure (skips base64 keys). Use at a request
// boundary to tokenise nested inputs (e.g. { profile: { name, email }, ... }).
export function scrubDeep<T = any>(value: T, mapping?: PseudonymMapping): T {
    if (typeof value === 'string') return scrubText(value, mapping) as unknown as T;
    if (Array.isArray(value)) return value.map((v) => scrubDeep(v, mapping)) as unknown as T;
    if (value && typeof value === 'object') {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = BINARY_KEYS.has(k) ? v : scrubDeep(v, mapping);
        }
        return out as unknown as T;
    }
    return value;
}

export function createStreamRehydrator(
    mapping: PseudonymMapping,
    emit: (chunk: string) => void
): { push(chunk: string): void; flush(): void } {
    let pending = '';
    // Hold back the LONGEST trailing suffix that is itself a token prefix; emit the rest.
    const findHoldback = (buffer: string): number => {
        const max = Math.min(buffer.length, MAX_TOKEN_LEN);
        for (let len = max; len >= 1; len--) {
            if (isTokenPrefix(buffer.slice(buffer.length - len))) return buffer.length - len;
        }
        return buffer.length;
    };
    return {
        push(chunk: string) {
            const buffer = pending + (chunk || '');
            const splitAt = findHoldback(buffer);
            const safe = buffer.slice(0, splitAt);
            pending = buffer.slice(splitAt);
            if (safe) emit(rehydrateText(safe, mapping));
        },
        flush() {
            if (pending) emit(rehydrateText(pending, mapping));
            pending = '';
        },
    };
}

export function maskEmailsDeep<T = any>(value: T): T {
    if (typeof value === 'string') return value.replace(EMAIL_REGEX, '[EMAIL]') as unknown as T;
    if (Array.isArray(value)) return value.map(maskEmailsDeep) as unknown as T;
    if (value && typeof value === 'object') {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = (k === 'data' || k === 'inlineData') ? v : maskEmailsDeep(v);
        }
        return out as unknown as T;
    }
    return value;
}
