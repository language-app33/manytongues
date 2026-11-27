/*
 * One word set per course (0.696).
 *
 * Two teachers who each wrote the pronouns, or the numbers, and each put
 * them in a module of the same course used to send that course's students
 * two of everything. Now a word set is shared with a space as one teacher's
 * set, listed in Material beside the others, editable by any teacher there,
 * and a course uses one teacher's set of each kind. Since 0.713 that is the
 * school's: one per kind and language in a space, the first written; a
 * course's stored choice is no longer read.
 *
 * Replaces numbers-choice.test.mjs: whose numbers a module used was chosen
 * on the module from 0.541, and is the course's choice now.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = await mkdtemp(path.join(tmpdir(), "manytongues-word-sets-"));
process.env.DATA_DIR = dir;
process.env.ADMIN_KEY = "word-sets-admin";
const { createApp } = await import("../server/index.js");
const { modulesForSystem } = await import("../src/number-modules.ts");

const server = createApp();
await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
const at = /** @type {import("node:net").AddressInfo} */ (server.address());
const origin = `http://127.0.0.1:${at.port}`;
after(async () => {
  await new Promise((resolve) => server.close(() => resolve(undefined)));
  await rm(dir, { recursive: true, force: true });
});

/** @param {string} action @param {{ key?: string, body?: unknown, params?: Record<string, string>, org?: string }} [o] */
async function api(action, { key, body, params, org } = {}) {
  const url = new URL(`${origin}/api/courses`);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const headers = /** @type {Record<string, string>} */ ({ "content-type": "application/json" });
  if (key) headers["x-key"] = key;
  if (org) headers["x-org"] = org;
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}
/** The same, where anything but 200 is the test failing. */
async function ok(/** @type {string} */ action, /** @type {any} */ o) {
  const r = await api(action, o);
  assert.equal(r.status, 200, `${action}: ${JSON.stringify(r.json)}`);
  return r.json;
}

const PERSONS = ["i", "i-f", "you-m", "you-f", "he", "she", "we", "you-pl", "they"];
const system = (/** @type {string} */ word) => ({
  id: "",
  languageId: "ar-PS",
  composerVersion: 1,
  lexemes: { "unit.1": { slot: "unit.1", forms: { standalone: word } } },
  overrides: {},
  nouns: [],
  audioPolicy: "components",
  rev: 0,
  created: 0,
  updated: 1000,
});
const pronoun = (/** @type {string} */ person, /** @type {string} */ word) => ({
  id: "", lang: "ar-PS", category: "pronoun", person, forms: [{ ar: word, lat: word, en: person }],
});

const admin = (await api("signup", { body: { displayName: "Owner" } })).json;
await ok("claim-admin", { key: admin.key, body: { adminKey: "word-sets-admin" } });

/** A course with two teachers and a student, in the space the admin acts in. */
async function classroom(/** @type {string} */ tag, /** @type {string | undefined} */ org = undefined) {
  const course = (await ok("create-course", { key: admin.key, org, body: { title: `Arabic ${tag}`, language: "ar-PS" } })).course;
  const mk = async (/** @type {string} */ name, /** @type {string[]} */ roles) => {
    const r = await ok("admin-create-user", { key: admin.key, org, body: { displayName: name, courseId: course.id, roles } });
    return { key: r.key, handle: r.user.handle };
  };
  return { course, a: await mk(`A ${tag}`, ["teacher"]), b: await mk(`B ${tag}`, ["teacher"]), s: await mk(`S ${tag}`, ["student"]) };
}

/** A teacher's pronouns, written in My space and moved into the space on a module of the course. */
async function pronounsModule(/** @type {any} */ t, /** @type {string} */ tag, /** @type {string} */ courseId) {
  const deck = (await ok("create-deck", { key: t.key, body: { title: `Pronouns ${tag}`, lang: "ar-PS", personal: true } })).deck;
  for (const p of PERSONS) await ok("save-card", { key: t.key, body: { personal: true, decks: [deck.id], card: pronoun(p, `${tag}-${p}`) } });
  await ok("copy-to-space", { key: t.key, body: { deckId: deck.id, move: true, courses: [courseId] } });
  return deck;
}

/** The pronouns a student's device is sent, as "person=word". */
/** @returns {Promise<string[]>} */
async function pronounsSent(/** @type {string} */ key) {
  const m = await ok("my-material", { key });
  return m.cards.flatMap((/** @type {any} */ b) => b.cards)
    .filter((/** @type {any} */ c) => c.category === "pronoun")
    .map((/** @type {any} */ c) => `${c.person}=${c.forms[0].ar}`);
}

/** A space of its own (0.713): the school's set is one per space, so a
    test that asks whose it is starts from a space with none. */
async function aSpace(/** @type {string} */ tag) {
  const made = await ok("admin-create-org", { key: admin.key, body: { name: `Space ${tag}`, slug: `space-${tag}`, adminName: `Admin ${tag}` } });
  return made.org.id;
}

test("two teachers' pronouns on one course reach its students once, the school's set", async () => {
  const { course, a, b, s } = await classroom("pron", await aSpace("pron"));
  await pronounsModule(a, "A", course.id);
  await pronounsModule(b, "B", course.id);

  /* The school's set is the one written first, which is A's — and only
     A's, in both modules. */
  let sent = await pronounsSent(s.key);
  assert.equal(sent.length, PERSONS.length * 2, "each module still holds the set");
  assert.equal(new Set(sent).size, PERSONS.length, "but one teacher's set, not two");
  assert.ok(sent.every((x) => x.endsWith(`=A-${x.split("=")[0]}`)), sent.join(", "));

  let sets = (await ok("course-word-sets", { key: b.key, params: { course: course.id } })).sets;
  assert.equal(sets.pronouns.using, a.handle);
  assert.deepEqual(sets.pronouns.reaching.sort(), [a.handle, b.handle].sort());

  /* A course's choice is no longer read (0.713): choosing B changes
     nothing students get. */
  await ok("set-course-word-set", { key: b.key, body: { courseId: course.id, kind: "pronouns", from: b.handle } });
  sent = await pronounsSent(s.key);
  assert.equal(new Set(sent).size, PERSONS.length);
  assert.ok(sent.every((x) => x.includes("=A-")), sent.join(", "));
  sets = (await ok("course-word-sets", { key: a.key, params: { course: course.id } })).sets;
  assert.equal(sets.pronouns.using, a.handle);

  /* A student can't choose or look; a stranger can't be chosen. */
  assert.equal((await api("set-course-word-set", { key: s.key, body: { courseId: course.id, kind: "pronouns", from: s.handle } })).status, 403);
  assert.equal((await api("course-word-sets", { key: s.key, params: { course: course.id } })).status, 403);
  assert.equal((await api("set-course-word-set", { key: a.key, body: { courseId: course.id, kind: "pronouns", from: s.handle } })).status, 400);
});

test("an edit to the chosen teacher's pronouns reaches modules that hold the other set", async () => {
  const { course, a, b, s } = await classroom("edit", await aSpace("edit"));
  await pronounsModule(a, "A", course.id);
  await pronounsModule(b, "B", course.id);
  const before = await ok("my-material", { key: s.key });
  /* Another teacher edits the school's pronoun, A's (2a): it stays A's. */
  const shared = (await ok("space-word-sets", { key: b.key })).pronouns.find((/** @type {any} */ p) => p.owner === a.handle);
  const he = shared.cards.find((/** @type {any} */ c) => c.person === "he");
  const saved = await ok("save-card", { key: b.key, body: { card: { ...he, forms: [{ ...he.forms[0], ar: "A-he-fixed" }] }, decks: he.decks } });
  assert.equal(saved.card.owner, a.handle);
  const after = await ok("my-material", { key: s.key, params: { version: before.version } });
  assert.ok(!after.unchanged, "the student's device is told to fetch");
  assert.ok((await pronounsSent(s.key)).includes("he=A-he-fixed"));
});

test("two teachers' numbers on one course: one set for both modules, the school's set", async () => {
  const { course, a, b, s } = await classroom("num");
  /** @type {Record<string, any>} */
  const sys = {};
  for (const [t, tag] of /** @type {[any, string][]} */ ([[a, "A"], [b, "B"]])) {
    sys[tag] = (await ok("save-system", { key: t.key, body: { kind: "numbers", system: system(`${tag}-one`) } })).system;
    const deck = (await ok("create-deck", { key: t.key, body: { title: `Numbers ${tag}`, description: "", lang: "ar-PS" } })).deck;
    await ok("attach-deck", { key: t.key, body: { deckId: deck.id, courseId: course.id } });
    await ok("set-deck-parts", { key: t.key, body: { deckId: deck.id, parts: ["numbers:0-10"] } });
  }
  const filed = async () => (await ok("my-material", { key: s.key })).decks.map((/** @type {any} */ d) => d.numbersSystemId);
  assert.deepEqual(await filed(), [sys.A.id, sys.A.id], "the first written, in both modules");
  /* A course's choice is no longer read (0.713). */
  await ok("set-course-word-set", { key: a.key, body: { courseId: course.id, kind: "numbers", from: b.handle } });
  assert.deepEqual(await filed(), [sys.A.id, sys.A.id]);
  /* Both are listed in Material, already used by the space's modules. */
  const listed = (await ok("space-word-sets", { key: a.key })).numbers.map((/** @type {any} */ n) => n.owner);
  assert.ok(listed.includes(a.handle) && listed.includes(b.handle));
});

test("numbers saved in a space with none become the school's without sharing", async () => {
  const { a } = await classroom("auto", await aSpace("auto"));
  const before = await ok("space-word-sets", { key: a.key });
  assert.equal(before.numbers.length, 0, "the space starts with no numbers");
  await ok("save-system", { key: a.key, body: { kind: "numbers", system: system("auto-one") } });
  const after = await ok("space-word-sets", { key: a.key });
  assert.ok(after.numbers.some((/** @type {any} */ n) => n.owner === a.handle), "not listed without a Share");
  assert.equal(after.school.numbers["ar-PS"], a.handle);
});

test("space-word-sets names the school's set", async () => {
  const { course, a, b } = await classroom("names", await aSpace("names"));
  await pronounsModule(a, "A", course.id);
  await pronounsModule(b, "B", course.id);
  const sets = await ok("space-word-sets", { key: b.key });
  assert.equal(sets.pronouns.length, 2, "both teachers' pronouns are in the space");
  assert.equal(sets.school.pronouns["ar-PS"], a.handle);
});

test("sharing pronouns copies them into the space, once per teacher", async () => {
  const { a, b } = await classroom("share");
  for (const p of PERSONS.slice(0, 3)) await ok("save-card", { key: a.key, body: { personal: true, decks: [], card: pronoun(p, `mine-${p}`) } });
  const listed = async () => (await ok("space-word-sets", { key: b.key })).pronouns.filter((/** @type {any} */ p) => p.owner === a.handle);
  assert.equal((await listed()).length, 0, "nothing shared yet");
  const first = await ok("share-word-set", { key: a.key, body: { kind: "pronouns", lang: "ar-PS" } });
  assert.equal(first.made, 3);
  let sets = await listed();
  assert.equal(sets.length, 1);
  assert.equal(sets[0].cards.length, 3);
  /* Shared again after a change: brought up to date, not duplicated. */
  const mine = (await ok("my-cards", { key: a.key })).cards.find((/** @type {any} */ c) => c.personal && c.person === "i");
  await ok("save-card", { key: a.key, body: { card: { ...mine, forms: [{ ...mine.forms[0], ar: "mine-i-2" }] }, decks: [] } });
  const again = await ok("share-word-set", { key: a.key, body: { kind: "pronouns", lang: "ar-PS" } });
  assert.equal(again.made, 0);
  sets = await listed();
  assert.equal(sets[0].cards.length, 3);
  assert.ok(sets[0].cards.some((/** @type {any} */ c) => c.forms[0].ar === "mine-i-2"));
  /* Another teacher fills in a missing pronoun of A's set: it is A's. */
  const r = await ok("save-card", { key: b.key, body: { card: pronoun("he", "filled-by-b"), decks: [], forOwner: a.handle } });
  assert.equal(r.card.owner, a.handle);
  assert.equal((await listed())[0].cards.length, 4);
  /* But not into a set that isn't shared. */
  assert.equal((await api("save-card", { key: a.key, body: { card: pronoun("she", "x"), decks: [], forOwner: b.handle } })).status, 403);
});

test("sharing numbers lists them in the space, where another teacher may edit them", async () => {
  /* In the space the numbers test above gave a school set (0.713), so a
     second teacher's numbers are theirs until shared. */
  const { a, b } = await classroom("sharenum");
  const mine = (await ok("save-system", { key: a.key, body: { kind: "numbers", system: system("one") } })).system;
  const listed = async () => (await ok("space-word-sets", { key: b.key })).numbers.filter((/** @type {any} */ n) => n.owner === a.handle);
  assert.equal((await listed()).length, 0);
  /* Not shared: B can't save it. */
  assert.equal((await api("save-system", { key: b.key, body: { kind: "numbers", owner: a.handle, system: { ...mine } } })).status, 403);
  await ok("share-word-set", { key: a.key, body: { kind: "numbers", lang: "ar-PS" } });
  assert.equal((await listed()).length, 1);
  const edited = await ok("save-system", {
    key: b.key,
    body: { kind: "numbers", owner: a.handle, system: { ...mine, lexemes: { "unit.1": { slot: "unit.1", forms: { standalone: "uno" } } } } },
  });
  assert.equal(edited.system.owner, a.handle);
  assert.equal(edited.system.id, mine.id, "the same set, not a copy");
  assert.equal((edited.system.spaces || []).length, 1, "still shared, with this space");
  /* A's own next save keeps it shared. */
  const own = await ok("save-system", { key: a.key, body: { kind: "numbers", system: edited.system } });
  assert.ok((own.system.spaces || []).length);
});

test("another space's word sets are not listed", async () => {
  const made = await ok("admin-create-org", { key: admin.key, body: { name: "Elsewhere", slug: "elsewhere", adminName: "E" } });
  const { a } = await classroom("main-side");
  const other = await classroom("b-side", made.org.id);
  await ok("save-card", { key: other.a.key, body: { personal: true, decks: [], card: pronoun("i", "far") } });
  await ok("share-word-set", { key: other.a.key, body: { kind: "pronouns", lang: "ar-PS" } });
  const here = await ok("space-word-sets", { key: a.key });
  assert.ok(!here.pronouns.some((/** @type {any} */ p) => p.owner === other.a.handle));
  /* And a student has no Material to list. */
  assert.equal((await api("space-word-sets", { key: other.s.key })).status, 403);
});

test("a system is filed only into the decks that name it", () => {
  const modules = [
    { id: "a", title: "A", lang: "ar-PS", numbersSystemId: "n1" },
    { id: "b", title: "B", lang: "ar-PS", numbersSystemId: "n2" },
    { id: "c", title: "C", lang: "ar-PS", numbersSystemId: null },
    { id: "d", title: "D", lang: "ar-PS" },
    { id: "e", title: "E", lang: "vi-VN", numbersSystemId: "n1" },
  ];
  const ids = (/** @type {string} */ sys) =>
    modulesForSystem(/** @type {any} */ (modules), "ar-PS", sys).map((d) => d.id);
  /* A deck without the field came from an older server and takes every
     system, as before; null takes none. */
  assert.deepEqual(ids("n1"), ["a", "d"]);
  assert.deepEqual(ids("n2"), ["b", "d"]);
});
