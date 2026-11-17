// @ts-check
/*
 * A course's path on the server (0.613): making units, ordering them,
 * publishing one in a course once its checklist is clear, opening one
 * early, and what reaches a student. Over a socket, through the same
 * routing, with nothing stubbed — the way tests/server.test.mjs does it.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { holedParts, sentencesOf } from "../src/review.ts";
import { LANGUAGES } from "../src/languages.ts";

const dir = await mkdtemp(path.join(tmpdir(), "manytongues-path-"));
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

/** @param {string} pathname @param {{ method?: string, key?: string, body?: unknown }} [opts] */
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

/** @type {Promise<string> | null} */
let mainCode = null;
const codeForMain = () => (mainCode ||= (async () => {
  const first = await raw("/api/courses?action=signup", { method: "POST", body: { displayName: "Site owner" } });
  await raw("/api/courses?action=claim-admin", { method: "POST", key: first.json.key, body: { adminKey: ADMIN_KEY } });
  const orgs = await raw("/api/courses?action=admin-orgs", { key: first.json.key });
  return orgs.json.orgs.find((/** @type {any} */ o) => o.id === "main").inviteCode;
})());

/** @param {string} action @param {string} key @param {unknown} [body] */
const post = (action, key, body = {}) => raw(`/api/courses?action=${action}`, { method: "POST", key, body });

/** @param {string} displayName */
const someone = async (displayName) => {
  const made = await raw("/api/courses?action=signup", { method: "POST", body: { displayName, code: await codeForMain() } });
  assert.equal(made.status, 200, made.text);
  return { key: made.json.key, handle: made.json.user.handle };
};
/** @param {string} displayName */
const anAdmin = async (displayName) => {
  const who = await someone(displayName);
  const claim = await post("claim-admin", who.key, { adminKey: ADMIN_KEY });
  assert.equal(claim.status, 200, claim.text);
  return who;
};
/** @param {string} key @param {string} title @param {string} [language] */
const aCourse = async (key, title, language = "vi") => {
  const r = await post("create-course", key, { title, language });
  assert.equal(r.status, 200, r.text);
  return r.json.course;
};
/** @param {string} key @param {string} courseId @param {string} title */
const aUnit = async (key, courseId, title) => {
  const r = await post("create-unit", key, { courseId, title });
  assert.equal(r.status, 200, r.text);
  return r.json.deck;
};
/** @param {string} key @param {string} courseId @param {string} handle */
const enrol = async (key, courseId, handle) => {
  const r = await post("assign-student", key, { courseId, handle });
  assert.equal(r.status, 200, r.text);
};
/** @param {string} key */
const material = async (key) => (await raw("/api/courses?action=my-material", { key })).json;
/** @param {string} key @param {string} id */
const courseOf = async (key, id) => (await raw(`/api/courses?action=course-decks&course=${id}`, { key })).json.course;

const vi = LANGUAGES["vi"];

/**
 * A unit that clears its checklist: five words that fill `{{food}}` and
 * five sentences, each approved for all five words.
 * @param {string} key @param {string} deckId @param {string} tag
 */
async function fillUnit(key, deckId, tag) {
  /** @type {any[]} */
  const words = [];
  for (const w of ["pho", "com", "banh", "bun", "che"]) {
    const r = await post("save-card", key, {
      card: { id: "", lang: "vi", category: "noun", fills: [`food${tag}`], forms: [{ ar: `${w}${tag}`, en: `${w} ${tag}`, lat: "" }] },
      decks: [deckId],
    });
    assert.equal(r.status, 200, r.text);
    words.push(r.json.card);
  }
  for (const v of ["an", "nau", "mua", "thich", "ghet"]) {
    const r = await post("save-card", key, {
      card: { id: "", lang: "vi", forms: [{ ar: `tôi ${v} {{food${tag}}}`, en: `I ${v} {{food${tag}}}`, lat: "" }] },
      decks: [deckId],
    });
    assert.equal(r.status, 200, r.text);
    const card = r.json.card;
    const ok = holedParts(card).flatMap((part) => sentencesOf(card, part, words, vi).list.map((s) => s.key));
    assert.equal(ok.length, 5);
    const rev = await post("review-card", key, { cardId: card.id, ok });
    assert.equal(rev.status, 200, rev.text);
  }
  return words;
}

test("a new unit is on the course's decks and path, and a draft reaches no student", async () => {
  const teacher = await anAdmin("Thu");
  const course = await aCourse(teacher.key, "Vietnamese 1");
  const u = await aUnit(teacher.key, course.id, "Greetings");
  assert.equal(u.unit, true);
  assert.equal(u.lang, "vi");
  const c = await courseOf(teacher.key, course.id);
  assert.deepEqual(c.decks, [u.id]);
  assert.deepEqual(c.path, [u.id]);
  const student = await someone("Lan");
  await enrol(teacher.key, course.id, student.handle);
  const m = await material(student.key);
  assert.ok(!m.decks.some((/** @type {any} */ d) => d.id === u.id), "a draft unit was sent");
});

test("publishing an empty unit is refused with what is missing, and it stays a draft", async () => {
  const teacher = await anAdmin("Hoa");
  const course = await aCourse(teacher.key, "Vietnamese 2");
  const u = await aUnit(teacher.key, course.id, "Empty");
  const r = await post("publish-unit", teacher.key, { courseId: course.id, deckId: u.id });
  assert.equal(r.status, 409, r.text);
  assert.equal(r.json.error, "unit-not-ready");
  assert.deepEqual(r.json.problems.find((/** @type {any} */ p) => p.kind === "few-sentences"), { kind: "few-sentences", have: 0, need: 5 });
  const c = await courseOf(teacher.key, course.id);
  assert.equal((c.pathLive || {})[u.id], undefined);
  const early = await post("open-unit", teacher.key, { courseId: course.id, deckId: u.id, open: true });
  assert.equal(early.status, 409);
  assert.equal(early.json.error, "unit-draft");
});

test("a unit that clears its checklist publishes; moving, publishing and opening each move the version", async () => {
  const teacher = await anAdmin("Minh");
  const course = await aCourse(teacher.key, "Vietnamese 3");
  const u1 = await aUnit(teacher.key, course.id, "Food");
  const u2 = await aUnit(teacher.key, course.id, "Later");
  await fillUnit(teacher.key, u1.id, "a");
  const student = await someone("An");
  await enrol(teacher.key, course.id, student.handle);
  const before = await material(student.key);
  assert.ok(!before.decks.some((/** @type {any} */ d) => d.id === u1.id));

  const pub = await post("publish-unit", teacher.key, { courseId: course.id, deckId: u1.id });
  assert.equal(pub.status, 200, pub.text);
  assert.ok(pub.json.course.pathLive[u1.id] > 0);
  const again = await post("publish-unit", teacher.key, { courseId: course.id, deckId: u1.id });
  assert.equal(again.status, 200, "publishing twice is fine and changes nothing");
  assert.equal(again.json.course.pathLive[u1.id], pub.json.course.pathLive[u1.id]);
  const published = await material(student.key);
  assert.notEqual(published.version, before.version);
  const sent = published.decks.find((/** @type {any} */ d) => d.id === u1.id);
  assert.ok(sent, "the published unit reaches the student");
  assert.equal(sent.unit, true);
  assert.equal(sent.cardIds.length, 10);
  assert.ok(!published.decks.some((/** @type {any} */ d) => d.id === u2.id), "its draft neighbour does not");
  const sentCourse = published.courses.find((/** @type {any} */ c) => c.id === course.id);
  assert.deepEqual(sentCourse.path, [u1.id, u2.id]);

  const moved = await post("move-unit", teacher.key, { courseId: course.id, deckId: u2.id, to: 0 });
  assert.equal(moved.status, 200, moved.text);
  assert.deepEqual(moved.json.course.path, [u2.id, u1.id]);
  const afterMove = await material(student.key);
  assert.notEqual(afterMove.version, published.version);

  const opened = await post("open-unit", teacher.key, { courseId: course.id, deckId: u1.id, open: true });
  assert.equal(opened.status, 200, opened.text);
  assert.deepEqual(opened.json.course.opened, [u1.id]);
  const afterOpen = await material(student.key);
  assert.notEqual(afterOpen.version, afterMove.version);
  const closed = await post("open-unit", teacher.key, { courseId: course.id, deckId: u1.id, open: false });
  assert.equal(closed.json.course.opened, undefined);
});

test("a unit added to a second course is a draft there and stays published in the first", async () => {
  const teacher = await anAdmin("Binh");
  const one = await aCourse(teacher.key, "Course one");
  const two = await aCourse(teacher.key, "Course two");
  const plainDeck = (await post("create-deck", teacher.key, { title: "Plain", lang: "vi" })).json.deck;
  await post("attach-deck", teacher.key, { deckId: plainDeck.id, courseId: two.id });
  const u = await aUnit(teacher.key, one.id, "Shared");
  await fillUnit(teacher.key, u.id, "b");
  assert.equal((await post("publish-unit", teacher.key, { courseId: one.id, deckId: u.id })).status, 200);

  const attach = await post("attach-deck", teacher.key, { deckId: u.id, courseId: two.id });
  assert.equal(attach.status, 200, attach.text);
  assert.deepEqual(attach.json.course.path, [u.id]);
  assert.equal((attach.json.course.pathLive || {})[u.id], undefined);
  assert.ok((await courseOf(teacher.key, one.id)).pathLive[u.id] > 0, "still published in the first course");

  const student = await someone("Khanh");
  await enrol(teacher.key, two.id, student.handle);
  assert.ok(!(await material(student.key)).decks.some((/** @type {any} */ d) => d.id === u.id), "sent before it was published there");
  assert.equal((await post("publish-unit", teacher.key, { courseId: two.id, deckId: u.id })).status, 200);
  assert.ok((await material(student.key)).decks.some((/** @type {any} */ d) => d.id === u.id));

  /* Taken out of the second course: off its path, publication and opening, and no other's. */
  await post("open-unit", teacher.key, { courseId: two.id, deckId: u.id, open: true });
  await post("open-unit", teacher.key, { courseId: one.id, deckId: u.id, open: true });
  const detach = await post("detach-deck", teacher.key, { deckId: u.id, courseId: two.id });
  assert.equal(detach.status, 200, detach.text);
  const twoNow = await courseOf(teacher.key, two.id);
  assert.deepEqual(twoNow.decks, [plainDeck.id]);
  assert.equal(twoNow.path, undefined);
  assert.equal(twoNow.pathLive, undefined);
  assert.equal(twoNow.opened, undefined);
  const oneNow = await courseOf(teacher.key, one.id);
  assert.deepEqual(oneNow.path, [u.id]);
  assert.ok(oneNow.pathLive[u.id] > 0);
  assert.deepEqual(oneNow.opened, [u.id]);
});

test("a card goes into two units and an ordinary deck at once; nothing is refused", async () => {
  const teacher = await anAdmin("Phuong");
  const course = await aCourse(teacher.key, "Free cards");
  const u1 = await aUnit(teacher.key, course.id, "One");
  const u2 = await aUnit(teacher.key, course.id, "Two");
  const plainDeck = (await post("create-deck", teacher.key, { title: "Plain", lang: "vi" })).json.deck;
  const r = await post("save-card", teacher.key, {
    card: { id: "", lang: "vi", forms: [{ ar: "nhà", en: "house", lat: "" }] },
    decks: [u1.id, u2.id, plainDeck.id],
  });
  assert.equal(r.status, 200, r.text);
  const decks = (await raw("/api/courses?action=my-decks", { key: teacher.key })).json.decks;
  for (const id of [u1.id, u2.id, plainDeck.id]) {
    assert.ok(decks.find((/** @type {any} */ d) => d.id === id).cardIds.includes(r.json.card.id), `not in ${id}`);
  }
});

test("deleting a unit takes it off every course's path", async () => {
  const teacher = await anAdmin("Tuan");
  const one = await aCourse(teacher.key, "Del one");
  const two = await aCourse(teacher.key, "Del two");
  const u = await aUnit(teacher.key, one.id, "Doomed");
  const keep = await aUnit(teacher.key, one.id, "Kept");
  await fillUnit(teacher.key, u.id, "c");
  await post("publish-unit", teacher.key, { courseId: one.id, deckId: u.id });
  await post("open-unit", teacher.key, { courseId: one.id, deckId: u.id, open: true });
  await post("attach-deck", teacher.key, { deckId: u.id, courseId: two.id });
  const gone = await post("delete-deck", teacher.key, { deckId: u.id });
  assert.equal(gone.status, 200, gone.text);
  for (const id of [one.id, two.id]) {
    const c = await courseOf(teacher.key, id);
    assert.ok(!(c.decks || []).includes(u.id));
    assert.ok(!(c.path || []).includes(u.id));
    assert.ok(!Object.keys(c.pathLive || {}).includes(u.id));
    assert.ok(!(c.opened || []).includes(u.id));
  }
  assert.deepEqual((await courseOf(teacher.key, one.id)).path, [keep.id]);
});

test("a course with no units sends nothing of a path, and a unit's draft elsewhere moves nothing", async () => {
  const teacher = await anAdmin("Lien");
  const course = await aCourse(teacher.key, "No units");
  const plainDeck = (await post("create-deck", teacher.key, { title: "Plain", lang: "vi" })).json.deck;
  await post("save-card", teacher.key, { card: { id: "", lang: "vi", forms: [{ ar: "mèo", en: "cat", lat: "" }] }, decks: [plainDeck.id] });
  await post("attach-deck", teacher.key, { deckId: plainDeck.id, courseId: course.id });
  const student = await someone("Vy");
  await enrol(teacher.key, course.id, student.handle);
  const first = await material(student.key);
  const sent = first.courses.find((/** @type {any} */ c) => c.id === course.id);
  assert.equal(sent.path, undefined);
  assert.equal(sent.pathLive, undefined);
  assert.equal(sent.opened, undefined);
  assert.equal(first.decks.find((/** @type {any} */ d) => d.id === plainDeck.id).unit, undefined);
  /* A unit in a course this student is not in changes nothing for them. */
  const other = await aCourse(teacher.key, "Elsewhere");
  await aUnit(teacher.key, other.id, "Not theirs");
  const again = await material(student.key);
  assert.equal(again.version, first.version);
});

test("only a teacher of the course or someone who runs the space works on its path", async () => {
  const teacher = await anAdmin("Quang");
  const course = await aCourse(teacher.key, "Guarded");
  const stranger = await someone("Stranger");
  const r = await post("create-unit", stranger.key, { courseId: course.id, title: "Mine" });
  assert.equal(r.status, 403);
  const noTitle = await post("create-unit", teacher.key, { courseId: course.id, title: " " });
  assert.equal(noTitle.status, 400);
});

/* ---- the units reached survive an upload that does not know them (0.615) ---- */

/** @param {string} token @param {{ method?: string, body?: unknown }} [o] */
const syncCall = async (token, { method = "GET", body } = {}) => {
  const res = await fetch(`${origin}/api/sync`, {
    method, headers: { "content-type": "application/json", "x-sync-token": token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};

test("an upload with an older list of units reached keeps the units the server holds", async () => {
  const token = "ab".repeat(32);
  const item = { id: "w1", tags: [], forms: [{ id: "w1", ar: "x", en: "x", s: {} }] };
  const first = await syncCall(token, { method: "POST", body: { data: { items: [item], settings: { pathReached: { A: ["u1", "u2", "u3"] } } } } });
  assert.equal(first.status, 200, JSON.stringify(first.json));
  /* A device on an older build: it read the document, then sends settings
     of its own with only the first unit, and a different theme. */
  const read = await syncCall(token);
  const older = await syncCall(token, {
    method: "POST",
    body: { etag: read.json.etag, data: { items: [item], settings: { theme: "dark", pathReached: { A: ["u1"] } } } },
  });
  assert.equal(older.status, 200, JSON.stringify(older.json));
  const after = await syncCall(token);
  assert.deepEqual(after.json.data.settings.pathReached, { A: ["u1", "u2", "u3"] });
  assert.equal(after.json.data.settings.theme, "dark", "every other setting is still the upload's");
});
