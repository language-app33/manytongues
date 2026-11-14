// @ts-check
/*
 * A course's switches on the server (0.627): written by a teacher of the
 * course, kept through every other write to the course, sent to students
 * with the material, and moving its version.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = await mkdtemp(path.join(tmpdir(), "manytongues-practice-"));
process.env.DATA_DIR = dir;
const ADMIN_KEY = "test-admin-key";
process.env.ADMIN_KEY = ADMIN_KEY;
const { createApp } = await import("../server/index.js");

const server = createApp();
await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
const at = server.address();
if (!at || typeof at === "string") throw new Error("expected a port");
const origin = `http://127.0.0.1:${at.port}`;
after(async () => {
  await new Promise((resolve) => server.close(() => resolve(undefined)));
  await rm(dir, { recursive: true, force: true });
});

/** @param {string} pathname @param {{ method?: string, key?: string, body?: unknown }} [o] */
async function raw(pathname, { method = "GET", key, body } = {}) {
  /** @type {Record<string, string>} */
  const headers = { "content-type": "application/json" };
  if (key) headers["x-key"] = key;
  const res = await fetch(`${origin}${pathname}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}
const post = (/** @type {string} */ action, /** @type {string} */ key, body = {}) =>
  raw(`/api/courses?action=${action}`, { method: "POST", key, body });

const owner = (await post("signup", "", { displayName: "Owner" })).json;
await post("claim-admin", owner.key, { adminKey: ADMIN_KEY });
const orgs = (await raw("/api/courses?action=admin-orgs", { key: owner.key })).json;
const invite = orgs.orgs.find((/** @type {any} */ o) => o.id === "main").inviteCode;
const someone = async (/** @type {string} */ name) => (await post("signup", "", { displayName: name, code: invite })).json;

const course = (await post("create-course", owner.key, { title: "Arabic", language: "ar-PS" })).json.course;
const teacher = await someone("Teacher");
const student = await someone("Student");
const stranger = await someone("Stranger");
await post("assign-teacher", owner.key, { courseId: course.id, handle: teacher.user.handle });
await post("assign-student", owner.key, { courseId: course.id, handle: student.user.handle });
const deck = (await post("create-deck", teacher.key, { title: "Words", lang: "ar-PS" })).json.deck;
await post("attach-deck", teacher.key, { courseId: course.id, deckId: deck.id });
await post("save-card", teacher.key, { card: { id: "", lang: "ar-PS", forms: [{ ar: "بيت", en: "house", lat: "beit" }] }, decks: [deck.id], publish: true });

const material = async () => (await raw("/api/courses?action=my-material", { key: student.key })).json;
const NONE = { mode: "none", off: ["tr2ar"] };

test("a course with no switches sends none, and a new course needs none", async () => {
  const m = await material();
  assert.equal(m.courses[0].practice, undefined);
});

test("only a teacher of the course may set its switches", async () => {
  assert.equal((await post("set-course-practice", stranger.key, { courseId: course.id, practice: NONE })).status, 403);
  assert.equal((await post("set-course-practice", student.key, { courseId: course.id, practice: NONE })).status, 403);
});

test("the switches reach students, and move the material's version", async () => {
  const before = (await material()).version;
  const r = await post("set-course-practice", teacher.key, { courseId: course.id, practice: NONE });
  assert.equal(r.status, 200, r.text);
  const m = await material();
  assert.deepEqual(m.courses[0].practice, NONE);
  assert.notEqual(m.version, before);
  const unchanged = await raw(`/api/courses?action=my-material&version=${m.version}`, { key: student.key });
  assert.equal(unchanged.json.unchanged, true);
});

test("what is not a mode or an exercise is narrowed away", async () => {
  await post("set-course-practice", teacher.key, { courseId: course.id, practice: { mode: "nope", off: ["en2ar", "<b>", 3] } });
  const m = await material();
  assert.equal(m.courses[0].practice.mode, "with");
  assert.deepEqual(m.courses[0].practice.off, ["en2ar", "b", "3"]);
  await post("set-course-practice", teacher.key, { courseId: course.id, practice: NONE });
});

test("every other write to the course keeps them", async () => {
  const other = await someone("Other");
  await post("assign-student", owner.key, { courseId: course.id, handle: other.user.handle });
  await post("remove-member", owner.key, { courseId: course.id, handle: other.user.handle, role: "student" });
  const unit = (await post("create-unit", teacher.key, { courseId: course.id, title: "Unit 1" })).json.deck;
  await post("publish-unit", teacher.key, { courseId: course.id, deckId: unit.id });
  const second = (await post("create-deck", teacher.key, { title: "More", lang: "ar-PS" })).json.deck;
  await post("attach-deck", teacher.key, { courseId: course.id, deckId: second.id });
  await post("detach-deck", teacher.key, { courseId: course.id, deckId: second.id });
  await post("admin-rename-course", owner.key, { courseId: course.id, title: "Arabic 1" });
  await post("save-card", teacher.key, { card: { id: "", lang: "ar-PS", forms: [{ ar: "باب", en: "door", lat: "bab" }] }, decks: [deck.id], publish: true });
  const m = await material();
  assert.deepEqual(m.courses[0].practice, NONE);
  const mine = (await raw("/api/courses?action=my-courses", { key: teacher.key })).json;
  assert.deepEqual((mine.courses || []).find((/** @type {any} */ c) => c.id === course.id).practice, NONE, "and the teacher's page reads them");
});
