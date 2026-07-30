/**
 * Cloud Storage security-rules tests for the Resources library.
 *
 * Run with: npm run rules:test (starts the Firestore + Storage emulators via emulators:exec).
 *
 * Resources are private per teacher and can include real classroom material, so the thing worth
 * proving is that one signed-in teacher cannot reach another's files — plus the size ceiling and
 * the deny-by-default outside the three known prefixes.
 */
import { readFileSync } from 'node:fs';
import { before, after, beforeEach, test } from 'node:test';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const OWNER = 'owner_uid';
const OTHER = 'other_uid';

const bytes = (size = 16) => new Uint8Array(size).fill(65);

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-teacher-planner',
    storage: {
      rules: readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

after(async () => { await env?.cleanup(); });

beforeEach(async () => { await env.clearStorage(); });

/** Seed a file as the owner, bypassing rules, so read tests start from a real object. */
const seed = async (path) => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), path), bytes());
  });
};

test('a teacher can write and read their own resources', async () => {
  const storage = env.authenticatedContext(OWNER).storage();
  const path = `users/${OWNER}/resources/res_1/plan.docx`;
  await assertSucceeds(uploadBytes(ref(storage, path), bytes()));
  await assertSucceeds(getBytes(ref(storage, path)));
  await assertSucceeds(deleteObject(ref(storage, path)));
});

test("another teacher cannot read or write someone else's resources", async () => {
  const path = `users/${OWNER}/resources/res_1/plan.docx`;
  await seed(path);

  const intruder = env.authenticatedContext(OTHER).storage();
  await assertFails(getBytes(ref(intruder, path)));
  await assertFails(uploadBytes(ref(intruder, path), bytes()));
  await assertFails(deleteObject(ref(intruder, path)));
});

test('signed-out users cannot read resources', async () => {
  const path = `users/${OWNER}/resources/res_1/plan.docx`;
  await seed(path);
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)));
});

test('brand kit and skill assets follow the same owner-only rule', async () => {
  const owner = env.authenticatedContext(OWNER).storage();
  const intruder = env.authenticatedContext(OTHER).storage();

  for (const path of [
    `users/${OWNER}/brand/logo.png`,
    `users/${OWNER}/brand/templates/tpl_1.pptx`,
    `users/${OWNER}/skills/skill_1/example.docx`,
  ]) {
    await assertSucceeds(uploadBytes(ref(owner, path), bytes()));
    await assertFails(getBytes(ref(intruder, path)));
  }
});

test('uploads above the size ceiling are rejected', async () => {
  const storage = env.authenticatedContext(OWNER).storage();
  const path = `users/${OWNER}/resources/res_big/huge.pdf`;
  // The rule allows < 25 MB; go just past it.
  await assertFails(uploadBytes(ref(storage, path), bytes(25 * 1024 * 1024 + 1)));
});

test('paths outside the known prefixes are denied even for the owner', async () => {
  const storage = env.authenticatedContext(OWNER).storage();
  await assertFails(uploadBytes(ref(storage, `users/${OWNER}/somewhere-else/x.txt`), bytes()));
  await assertFails(uploadBytes(ref(storage, 'public/x.txt'), bytes()));
});
