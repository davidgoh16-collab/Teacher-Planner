#!/usr/bin/env node
/**
 * Teacher Planner Firestore CLI
 *
 * Zero-dependency Node (>=18) script that reads/writes the Teacher Planner
 * app's Firestore database via the Firestore REST API, authenticating with a
 * Firebase service account key (which bypasses security rules, same as the
 * Admin SDK).
 *
 * Credentials are resolved in this order:
 *   1. $TEACHER_PLANNER_SERVICE_ACCOUNT (path to service account JSON)
 *   2. $GOOGLE_APPLICATION_CREDENTIALS  (path to service account JSON)
 *   3. <skill dir>/service-account.json (gitignored)
 *
 * Run with no arguments for usage.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIREBASE_PROJECT_ID = 'school-apps-52c7d';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

const COLLECTIONS = {
  project: 'teacher_planner_projects',
  task: 'teacher_planner_tasks',
  category: 'teacher_planner_categories',
  keydate: 'teacher_planner_key_dates',
  idea: 'teacher_planner_ideas',
  routine: 'teacher_planner_routine_tasks',
};

const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['Uncompleted', 'In Progress', 'Completed'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function skillDir() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function loadServiceAccount() {
  const candidates = [
    process.env.TEACHER_PLANNER_SERVICE_ACCOUNT,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(skillDir(), 'service-account.json'),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const sa = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (!sa.client_email || !sa.private_key) {
        fail(`${p} is not a valid service account key (missing client_email/private_key).`);
      }
      return sa;
    }
  }
  fail(
    'No service account key found. Download one from Firebase Console > Project settings > ' +
    'Service accounts > "Generate new private key" and save it to ' +
    `${path.join(skillDir(), 'service-account.json')} ` +
    '(or point TEACHER_PLANNER_SERVICE_ACCOUNT at it). See the skill SKILL.md "Setup" section.'
  );
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken() {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(sa.private_key)
    .toString('base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) {
    fail(`Failed to obtain access token (${res.status}): ${await res.text()}`);
  }
  return (await res.json()).access_token;
}

// ---------------------------------------------------------------------------
// Firestore REST helpers
// ---------------------------------------------------------------------------

let _token;
async function fsFetch(url, options = {}) {
  _token ??= await getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    fail(`Firestore request failed (${res.status}): ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

function toValue(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  throw new Error(`Cannot encode value of type ${typeof v}`);
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toValue(v);
  }
  return fields;
}

function fromValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return v;
}

function fromFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields || {})) obj[k] = fromValue(v);
  return obj;
}

async function listCollection(collection) {
  const docs = [];
  let pageToken;
  do {
    const url = new URL(`${BASE_URL}/${collection}`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await fsFetch(url);
    for (const d of data.documents || []) docs.push(fromFields(d.fields));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

async function getDocument(collection, id) {
  const res = await fetch(`${BASE_URL}/${collection}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${_token ??= await getAccessToken()}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) fail(`Firestore request failed (${res.status}): ${await res.text()}`);
  return fromFields((await res.json()).fields);
}

// Full overwrite — matches the app's setDoc(doc(db, col, item.id), item).
async function setDocument(collection, id, data) {
  await fsFetch(`${BASE_URL}/${collection}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFields(data) }),
  });
}

// Partial update of only the given fields.
async function updateDocument(collection, id, partial) {
  const url = new URL(`${BASE_URL}/${collection}/${encodeURIComponent(id)}`);
  for (const key of Object.keys(partial)) {
    if (partial[key] !== undefined) url.searchParams.append('updateMask.fieldPaths', key);
  }
  url.searchParams.append('currentDocument.exists', 'true');
  await fsFetch(url, { method: 'PATCH', body: JSON.stringify({ fields: toFields(partial) }) });
}

async function deleteDocument(collection, id) {
  const url = new URL(`${BASE_URL}/${collection}/${encodeURIComponent(id)}`);
  url.searchParams.append('currentDocument.exists', 'true');
  await fsFetch(url, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function ok(result) {
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || (next.startsWith('--') && next.length > 2)) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function requireArg(args, name, hint = '') {
  const v = args[name];
  if (v === undefined || v === true || String(v).trim() === '') {
    fail(`Missing required option --${name}${hint ? ` (${hint})` : ''}`);
  }
  return String(v);
}

function validateDate(value, name) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`--${name} must be in YYYY-MM-DD format, got "${value}"`);
  }
  return value;
}

function validateEnum(value, allowed, name) {
  const match = allowed.find((a) => a.toLowerCase() === String(value).toLowerCase());
  if (!match) fail(`--${name} must be one of: ${allowed.join(', ')} (got "${value}")`);
  return match;
}

async function resolveProject(ref) {
  if (!ref) return null;
  if (ref === 'global') return { id: 'global', name: '(no project)' };
  const projects = await listCollection(COLLECTIONS.project);
  const byId = projects.find((p) => p.id === ref);
  if (byId) return byId;
  const lower = String(ref).toLowerCase();
  const exact = projects.filter((p) => (p.name || '').toLowerCase() === lower);
  if (exact.length === 1) return exact[0];
  const partial = projects.filter((p) => (p.name || '').toLowerCase().includes(lower));
  if (partial.length === 1) return partial[0];
  fail(
    `Could not uniquely resolve project "${ref}". Available projects: ` +
    (projects.map((p) => p.name).join(', ') || '(none)')
  );
}

async function resolveCategory(ref, type) {
  if (!ref) return null;
  const categories = (await listCollection(COLLECTIONS.category)).filter((c) => c.type === type);
  const byId = categories.find((c) => c.id === ref);
  if (byId) return byId;
  const lower = String(ref).toLowerCase();
  const match = categories.filter((c) => (c.name || '').toLowerCase() === lower);
  if (match.length === 1) return match[0];
  fail(
    `Could not resolve ${type} category "${ref}". Available: ` +
    (categories.map((c) => c.name).join(', ') || '(none)')
  );
}

function parseDays(value) {
  return String(value).split(',').map((d) => {
    const trimmed = d.trim();
    if (/^\d$/.test(trimmed)) return Number(trimmed);
    const idx = DAY_NAMES.findIndex((n) => trimmed.toLowerCase().startsWith(n.toLowerCase()));
    if (idx === -1) fail(`Unrecognised day "${trimmed}". Use names (Mon,Tue,...) or numbers (0=Sun..6=Sat).`);
    return idx;
  });
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const commands = {
  async 'list-projects'() {
    const [projects, categories] = await Promise.all([
      listCollection(COLLECTIONS.project),
      listCollection(COLLECTIONS.category),
    ]);
    const catName = (id) => categories.find((c) => c.id === id)?.name;
    ok({
      projects: projects
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          category: catName(p.categoryId),
          links: (p.links || []).length,
        })),
    });
  },

  async 'list-tasks'(args) {
    const [tasks, projects] = await Promise.all([
      listCollection(COLLECTIONS.task),
      listCollection(COLLECTIONS.project),
    ]);
    const projectName = (id) => (id === 'global' ? null : projects.find((p) => p.id === id)?.name);
    let filtered = tasks;
    if (args.project) {
      const proj = await resolveProject(String(args.project));
      filtered = filtered.filter((t) => t.projectId === proj.id);
    }
    if (args.status) {
      const status = validateEnum(args.status, STATUSES, 'status');
      filtered = filtered.filter((t) => t.status === status);
    } else if (!args.all) {
      filtered = filtered.filter((t) => t.status !== 'Completed');
    }
    ok({
      note: args.status || args.all ? undefined : 'Completed tasks hidden; pass --all to include them.',
      tasks: filtered
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          project: projectName(t.projectId),
          scheduled: t.scheduledDateStr,
          deadline: t.deadlineDateStr,
          description: t.description,
          subtasks: (t.subtasks || []).map((s) => ({ id: s.id, title: s.title, status: s.status })),
        })),
    });
  },

  async 'list-categories'() {
    ok({ categories: await listCollection(COLLECTIONS.category) });
  },

  async 'list-keydates'(args) {
    let keyDates = await listCollection(COLLECTIONS.keydate);
    if (args.from) keyDates = keyDates.filter((k) => k.dateStr >= validateDate(String(args.from), 'from'));
    if (args.to) keyDates = keyDates.filter((k) => k.dateStr <= validateDate(String(args.to), 'to'));
    ok({ keyDates: keyDates.sort((a, b) => a.dateStr.localeCompare(b.dateStr)) });
  },

  async 'list-ideas'() {
    ok({ ideas: (await listCollection(COLLECTIONS.idea)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) });
  },

  async 'list-routines'() {
    const routines = await listCollection(COLLECTIONS.routine);
    ok({
      routines: routines.map((r) => ({
        ...r,
        daysOfWeek: r.daysOfWeek?.map((d) => DAY_NAMES[d]),
      })),
    });
  },

  async 'add-project'(args) {
    const name = requireArg(args, 'name');
    const category = args.category ? await resolveCategory(String(args.category), 'project') : null;
    const project = {
      id: newId('proj'),
      name,
      description: args.description ? String(args.description) : undefined,
      categoryId: category?.id,
      colorClass: args.color ? String(args.color) : undefined,
      links: [],
      tasks: [],
      createdAt: Date.now(),
    };
    await setDocument(COLLECTIONS.project, project.id, project);
    ok({ created: project });
  },

  async 'add-task'(args) {
    const title = requireArg(args, 'title');
    const project = args.project ? await resolveProject(String(args.project)) : null;
    const category = args.category ? await resolveCategory(String(args.category), 'task') : null;
    const task = {
      id: newId('task'),
      projectId: project?.id || 'global',
      title,
      description: args.description ? String(args.description) : undefined,
      status: 'Uncompleted',
      priority: args.priority ? validateEnum(args.priority, PRIORITIES, 'priority') : 'Medium',
      categoryId: category?.id,
      scheduledDateStr: args.scheduled ? validateDate(String(args.scheduled), 'scheduled') : undefined,
      deadlineDateStr: args.deadline ? validateDate(String(args.deadline), 'deadline') : undefined,
      assignedPeriodLabel: args.period ? String(args.period) : undefined,
      subtasks: [],
      createdAt: Date.now(),
    };
    await setDocument(COLLECTIONS.task, task.id, task);
    ok({ created: task, project: project?.name || '(no project)' });
  },

  async 'add-keydate'(args) {
    const title = requireArg(args, 'title');
    const dateStr = validateDate(requireArg(args, 'date', 'YYYY-MM-DD'), 'date');
    const category = args.category ? await resolveCategory(String(args.category), 'task') : null;
    const keyDate = {
      id: newId('kd'),
      title,
      dateStr,
      time: args.time ? String(args.time) : undefined,
      isAllDay: !args.time,
      notes: args.notes ? String(args.notes) : undefined,
      categoryId: category?.id,
      colorClass: args.color ? String(args.color) : 'bg-slate-200',
      createdAt: Date.now(),
    };
    await setDocument(COLLECTIONS.keydate, keyDate.id, keyDate);
    ok({ created: keyDate });
  },

  async 'add-idea'(args) {
    const text = requireArg(args, 'text');
    const project = args.project ? await resolveProject(String(args.project)) : null;
    const idea = {
      id: newId('idea'),
      text,
      projectId: project && project.id !== 'global' ? project.id : undefined,
      createdAt: Date.now(),
    };
    await setDocument(COLLECTIONS.idea, idea.id, idea);
    ok({ created: idea });
  },

  async 'add-routine'(args) {
    const title = requireArg(args, 'title');
    const type = validateEnum(requireArg(args, 'type', 'daily or weekly'), ['daily', 'weekly'], 'type');
    if (type === 'weekly' && !args.days) {
      fail('Weekly routines need --days (e.g. --days Mon,Wed,Fri)');
    }
    const routine = {
      id: newId('routine'),
      title,
      priority: args.priority ? validateEnum(args.priority, PRIORITIES, 'priority') : 'Medium',
      type,
      daysOfWeek: args.days ? parseDays(args.days) : undefined,
      completedDatesStr: [],
      createdAt: Date.now(),
    };
    await setDocument(COLLECTIONS.routine, routine.id, routine);
    ok({ created: { ...routine, daysOfWeek: routine.daysOfWeek?.map((d) => DAY_NAMES[d]) } });
  },

  async 'update-task'(args) {
    const id = requireArg(args, 'id');
    const existing = await getDocument(COLLECTIONS.task, id);
    if (!existing) fail(`No task with id "${id}". Use list-tasks to find the right id.`);
    const partial = {};
    if (args.title) partial.title = String(args.title);
    if (args.description) partial.description = String(args.description);
    if (args.priority) partial.priority = validateEnum(args.priority, PRIORITIES, 'priority');
    if (args.scheduled) partial.scheduledDateStr = validateDate(String(args.scheduled), 'scheduled');
    if (args.deadline) partial.deadlineDateStr = validateDate(String(args.deadline), 'deadline');
    if (args.project) partial.projectId = (await resolveProject(String(args.project))).id;
    if (args.status) {
      partial.status = validateEnum(args.status, STATUSES, 'status');
      if (partial.status === 'Completed') partial.completedAt = Date.now();
    }
    if (Object.keys(partial).length === 0) {
      fail('Nothing to update. Pass at least one of --title --description --priority --scheduled --deadline --project --status');
    }
    await updateDocument(COLLECTIONS.task, id, partial);
    ok({ updated: { id, ...partial }, was: { title: existing.title, status: existing.status } });
  },

  async 'complete-task'(args) {
    const id = requireArg(args, 'id');
    const existing = await getDocument(COLLECTIONS.task, id);
    if (!existing) fail(`No task with id "${id}". Use list-tasks to find the right id.`);
    await updateDocument(COLLECTIONS.task, id, { status: 'Completed', completedAt: Date.now() });
    ok({ completed: { id, title: existing.title } });
  },

  async 'delete'(args) {
    const type = requireArg(args, 'type', Object.keys(COLLECTIONS).join('|'));
    const id = requireArg(args, 'id');
    const collection = COLLECTIONS[type];
    if (!collection) fail(`Unknown --type "${type}". Use one of: ${Object.keys(COLLECTIONS).join(', ')}`);
    const existing = await getDocument(collection, id);
    if (!existing) fail(`No ${type} with id "${id}".`);
    await deleteDocument(collection, id);
    ok({ deleted: { type, id, title: existing.title || existing.name || existing.text } });
  },
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const [command, ...rest] = process.argv.slice(2);
if (!command || command === 'help' || command === '--help') {
  console.log(`Teacher Planner Firestore CLI

Usage: node planner.mjs <command> [options]

Read:
  list-projects
  list-tasks       [--project <name|id>] [--status <status>] [--all]
  list-categories
  list-keydates    [--from YYYY-MM-DD] [--to YYYY-MM-DD]
  list-ideas
  list-routines

Write:
  add-project   --name <name> [--description <text>] [--category <name>] [--color <tailwind-class>]
  add-task      --title <title> [--project <name|id>] [--description <text>]
                [--priority High|Medium|Low] [--scheduled YYYY-MM-DD]
                [--deadline YYYY-MM-DD] [--category <name>] [--period "Period 2"]
  add-keydate   --title <title> --date YYYY-MM-DD [--time HH:MM] [--notes <text>]
  add-idea      --text <text> [--project <name|id>]
  add-routine   --title <title> --type daily|weekly [--days Mon,Wed,Fri] [--priority High|Medium|Low]
  update-task   --id <id> [--title|--description|--priority|--scheduled|--deadline|--project|--status ...]
  complete-task --id <id>
  delete        --type project|task|category|keydate|idea|routine --id <id>

All output is JSON on stdout ({"ok":true,...}) or stderr ({"ok":false,"error":...}).`);
  process.exit(command ? 0 : 1);
}

const handler = commands[command];
if (!handler) fail(`Unknown command "${command}". Run with no arguments for usage.`);
await handler(parseArgs(rest));
