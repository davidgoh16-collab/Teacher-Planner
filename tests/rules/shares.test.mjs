/**
 * Firestore security-rules tests for the sharing model (shares docs double as access grants).
 *
 * Run with: npm run rules:test   (starts the Firestore emulator via firebase emulators:exec)
 *
 * Covers every query/write the app actually issues:
 *  - owner share creation (well-formed and malformed ids, direct + pending)
 *  - recipient "shared with me" list, pending-invite list by token email
 *  - claiming a pending invite (validated copy) and forged-claim denial
 *  - shared timetable subtree reads
 *  - shared project reads/writes per permission, incl. the tasks query-filter requirement
 */
import { readFileSync } from 'node:fs';
import { before, after, beforeEach, test } from 'node:test';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where,
} from 'firebase/firestore';

const OWNER = 'owner_uid';
const FRIEND = 'friend_uid';
const OTHER = 'other_uid';
const OWNER_EMAIL = 'owner@school.uk';
const FRIEND_EMAIL = 'friend@school.uk';
const OTHER_EMAIL = 'other@school.uk';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-teacher-planner',
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const ownerDb = () => env.authenticatedContext(OWNER, { email: OWNER_EMAIL }).firestore();
const friendDb = () => env.authenticatedContext(FRIEND, { email: FRIEND_EMAIL }).firestore();
const otherDb = () => env.authenticatedContext(OTHER, { email: OTHER_EMAIL }).firestore();

const directId = (type, resourceId, recipient = FRIEND) => `${OWNER}__${recipient}__${type}__${resourceId}`;
const pendingId = (type, resourceId, email = FRIEND_EMAIL) => `${OWNER}__email:${email}__${type}__${resourceId}`;

const shareDoc = (overrides = {}) => ({
  ownerUid: OWNER,
  ownerEmail: OWNER_EMAIL,
  ownerName: 'Owner',
  recipientUid: FRIEND,
  recipientEmail: FRIEND_EMAIL,
  type: 'timetable',
  resourceId: 'timetable',
  resourceName: 'Timetable',
  permission: 'view',
  createdAt: 1,
  ...overrides,
});

/** Seed data bypassing rules (as if written earlier by legitimate parties). */
const seed = (writes) => env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const [path, data] of writes) await setDoc(doc(db, path), data);
});

// ---------- share creation ----------

test('owner creates a well-formed direct timetable share', async () => {
  const id = directId('timetable', 'timetable');
  await assertSucceeds(setDoc(doc(ownerDb(), 'shares', id), shareDoc({ id })));
});

test('owner cannot create a share whose id does not match its fields', async () => {
  const id = directId('timetable', 'timetable');
  // id says FRIEND but doc claims OTHER as recipient
  await assertFails(setDoc(doc(ownerDb(), 'shares', id), shareDoc({ id, recipientUid: OTHER })));
  // id resource differs from field resource
  const id2 = directId('project', 'p1');
  await assertFails(setDoc(doc(ownerDb(), 'shares', id2), shareDoc({ id: id2, type: 'project', resourceId: 'p2', recipientUid: FRIEND })));
});

test('owner creates a pending share for an unregistered email (lower-case enforced)', async () => {
  const id = pendingId('project', 'p1');
  await assertSucceeds(setDoc(doc(ownerDb(), 'shares', id), shareDoc({
    id, type: 'project', resourceId: 'p1', resourceName: 'Project 1', recipientUid: null,
  })));
  const bad = `${OWNER}__email:Friend@School.uk__project__p1`;
  await assertFails(setDoc(doc(ownerDb(), 'shares', bad), shareDoc({
    id: bad, type: 'project', resourceId: 'p1', recipientUid: null, recipientEmail: 'Friend@School.uk',
  })));
});

test('a non-owner cannot create shares of someone else\'s data', async () => {
  const id = directId('timetable', 'timetable');
  await assertFails(setDoc(doc(otherDb(), 'shares', id), shareDoc({ id })));
});

// ---------- share listing ----------

test('recipient lists shares with them; owner lists shares by them; stranger sees neither', async () => {
  const id = directId('timetable', 'timetable');
  await seed([[`shares/${id}`, shareDoc({ id })]]);

  await assertSucceeds(getDocs(query(collection(friendDb(), 'shares'), where('recipientUid', '==', FRIEND))));
  await assertSucceeds(getDocs(query(collection(ownerDb(), 'shares'), where('ownerUid', '==', OWNER))));
  await assertFails(getDocs(query(collection(otherDb(), 'shares'), where('recipientUid', '==', FRIEND))));
});

test('pending invites are listable only by the addressee\'s token email', async () => {
  const id = pendingId('project', 'p1');
  await seed([[`shares/${id}`, shareDoc({ id, type: 'project', resourceId: 'p1', recipientUid: null })]]);

  await assertSucceeds(getDocs(query(
    collection(friendDb(), 'shares'),
    where('recipientEmail', '==', FRIEND_EMAIL), where('recipientUid', '==', null),
  )));
  await assertFails(getDocs(query(
    collection(otherDb(), 'shares'),
    where('recipientEmail', '==', FRIEND_EMAIL), where('recipientUid', '==', null),
  )));
});

// ---------- claiming ----------

test('addressee claims a pending invite: validated copy allowed, then pending deletable', async () => {
  const pid = pendingId('project', 'p1');
  await seed([[`shares/${pid}`, shareDoc({ id: pid, type: 'project', resourceId: 'p1', recipientUid: null, permission: 'edit' })]]);

  const nid = directId('project', 'p1');
  await assertSucceeds(setDoc(doc(friendDb(), 'shares', nid), shareDoc({
    id: nid, type: 'project', resourceId: 'p1', recipientUid: FRIEND, permission: 'edit',
  })));
  await assertSucceeds(deleteDoc(doc(friendDb(), 'shares', pid)));
});

test('claim is denied when permission is escalated or no pending doc exists', async () => {
  const pid = pendingId('project', 'p1');
  await seed([[`shares/${pid}`, shareDoc({ id: pid, type: 'project', resourceId: 'p1', recipientUid: null, permission: 'view' })]]);

  const nid = directId('project', 'p1');
  // escalating view -> edit during the claim
  await assertFails(setDoc(doc(friendDb(), 'shares', nid), shareDoc({
    id: nid, type: 'project', resourceId: 'p1', recipientUid: FRIEND, permission: 'edit',
  })));
  // forged claim with no pending invite at all
  const forged = directId('timetable', 'timetable');
  await assertFails(setDoc(doc(friendDb(), 'shares', forged), shareDoc({ id: forged, recipientUid: FRIEND })));
  // a different signed-in user cannot claim someone else's invite
  const hijack = `${OWNER}__${OTHER}__project__p1`;
  await assertFails(setDoc(doc(otherDb(), 'shares', hijack), shareDoc({
    id: hijack, type: 'project', resourceId: 'p1', recipientUid: OTHER, permission: 'view',
  })));
});

test('only the addressee can delete a pending invite (besides the owner)', async () => {
  const pid = pendingId('project', 'p1');
  await seed([[`shares/${pid}`, shareDoc({ id: pid, type: 'project', resourceId: 'p1', recipientUid: null })]]);
  await assertFails(deleteDoc(doc(otherDb(), 'shares', pid)));
  await assertSucceeds(deleteDoc(doc(ownerDb(), 'shares', pid)));
});

// ---------- share updates ----------

test('owner may flip permission but not rewrite identity fields; recipient may not update', async () => {
  const id = directId('project', 'p1');
  await seed([[`shares/${id}`, shareDoc({ id, type: 'project', resourceId: 'p1', recipientUid: FRIEND })]]);

  await assertSucceeds(updateDoc(doc(ownerDb(), 'shares', id), { permission: 'edit' }));
  await assertFails(updateDoc(doc(ownerDb(), 'shares', id), { recipientUid: OTHER }));
  await assertFails(updateDoc(doc(friendDb(), 'shares', id), { permission: 'edit' }));
});

// ---------- shared timetable data access ----------

const seedTimetable = () => seed([
  [`users/${OWNER}/teacher_planner_academic_years/y1`, { name: '2025/26', isDefault: true }],
  [`users/${OWNER}/teacher_planner_academic_years/y1/teacher_planner_timetables/week1`, { Monday: {} }],
]);

test('timetable subtree is unreadable without a share and readable with one', async () => {
  await seedTimetable();
  await assertFails(getDocs(collection(friendDb(), `users/${OWNER}/teacher_planner_academic_years`)));

  const id = directId('timetable', 'timetable');
  await seed([[`shares/${id}`, shareDoc({ id })]]);
  await assertSucceeds(getDocs(collection(friendDb(), `users/${OWNER}/teacher_planner_academic_years`)));
  await assertSucceeds(getDocs(collection(friendDb(), `users/${OWNER}/teacher_planner_academic_years/y1/teacher_planner_timetables`)));
  // a share grants read-only access, and only to the recipient
  await assertFails(setDoc(doc(friendDb(), `users/${OWNER}/teacher_planner_academic_years/y1`), { name: 'x' }));
  await assertFails(getDocs(collection(otherDb(), `users/${OWNER}/teacher_planner_academic_years`)));
});

// ---------- shared project + tasks data access ----------

const seedProjectData = () => seed([
  [`users/${OWNER}/teacher_planner_projects/p1`, { id: 'p1', name: 'Shared project' }],
  [`users/${OWNER}/teacher_planner_projects/p2`, { id: 'p2', name: 'Private project' }],
  [`users/${OWNER}/teacher_planner_tasks/t1`, { id: 't1', projectId: 'p1', title: 'Task in shared' }],
  [`users/${OWNER}/teacher_planner_tasks/t2`, { id: 't2', projectId: 'p2', title: 'Task in private' }],
]);

test('view share: project + filtered tasks readable; unfiltered task list denied (the old bug)', async () => {
  await seedProjectData();
  const id = directId('project', 'p1');
  await seed([[`shares/${id}`, shareDoc({ id, type: 'project', resourceId: 'p1', recipientUid: FRIEND, permission: 'view' })]]);

  await assertSucceeds(getDoc(doc(friendDb(), `users/${OWNER}/teacher_planner_projects/p1`)));
  await assertFails(getDoc(doc(friendDb(), `users/${OWNER}/teacher_planner_projects/p2`)));

  // The app must query with where('projectId','==',...) — an unfiltered list is not provable.
  await assertSucceeds(getDocs(query(
    collection(friendDb(), `users/${OWNER}/teacher_planner_tasks`),
    where('projectId', '==', 'p1'),
  )));
  await assertFails(getDocs(collection(friendDb(), `users/${OWNER}/teacher_planner_tasks`)));
  await assertFails(getDocs(query(
    collection(friendDb(), `users/${OWNER}/teacher_planner_tasks`),
    where('projectId', '==', 'p2'),
  )));

  // view permission cannot write tasks
  await assertFails(setDoc(doc(friendDb(), `users/${OWNER}/teacher_planner_tasks/t1`),
    { id: 't1', projectId: 'p1', title: 'Edited', status: 'Completed' }));
});

test('edit share: recipient can write tasks of the shared project only', async () => {
  await seedProjectData();
  const id = directId('project', 'p1');
  await seed([[`shares/${id}`, shareDoc({ id, type: 'project', resourceId: 'p1', recipientUid: FRIEND, permission: 'edit' })]]);

  await assertSucceeds(setDoc(doc(friendDb(), `users/${OWNER}/teacher_planner_tasks/t1`),
    { id: 't1', projectId: 'p1', title: 'Edited', status: 'Completed' }));
  // cannot write a task into (or move a task to) an unshared project
  await assertFails(setDoc(doc(friendDb(), `users/${OWNER}/teacher_planner_tasks/t2`),
    { id: 't2', projectId: 'p2', title: 'Hijack' }));
  await assertFails(setDoc(doc(friendDb(), `users/${OWNER}/teacher_planner_tasks/t1`),
    { id: 't1', projectId: 'p2', title: 'Move away' }));
});

// ---------- profile lookup (sharing by email depends on it) ----------

test('any signed-in user can look up profiles by email; anonymous cannot', async () => {
  await seed([[`users/${FRIEND}`, { uid: FRIEND, emailLower: FRIEND_EMAIL, displayName: 'Friend' }]]);
  await assertSucceeds(getDocs(query(collection(ownerDb(), 'users'), where('emailLower', '==', FRIEND_EMAIL))));
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDocs(query(collection(anon, 'users'), where('emailLower', '==', FRIEND_EMAIL))));
});
