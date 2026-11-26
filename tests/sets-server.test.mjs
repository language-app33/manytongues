// @ts-check
/*
 * Personal sets on the server (0.629): a deck's `set`, written by whoever
 * may edit the deck, kept through every other write to it, sent to
 * students with the material and moving its version; and who is speaking
 * on a recording, kept on the form for the recordings it has.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = await mkdtemp(path.join(tmpdir(), "manytongues-sets-"));
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

const course = (await post("create-course", owner.key, { title: "Vietnamese", language: "ar-PS" })).json.course;
const teacher = await someone("Teacher");
const student = await someone("Student");
await post("assign-teacher", owner.key, { courseId: course.id, handle: teacher.user.handle });
await post("assign-student", owner.key, { courseId: course.id, handle: student.user.handle });
const family = (await post("create-deck", teacher.key, { title: "Our family", lang: "ar-PS" })).json.deck;
const hanoi = (await post("create-deck", teacher.key, { title: "Hanoi", lang: "ar-PS" })).json.deck;
await post("attach-deck", teacher.key, { courseId: course.id, deckId: family.id });
await post("attach-deck", teacher.key, { courseId: course.id, deckId: hanoi.id });

const material = async () => (await raw("/api/courses?action=my-material", { key: student.key })).json;
const sentDeck = async (/** @type {string} */ id) => (await material()).decks.find((/** @type {any} */ d) => d.id === id);
/* The material's cards come bundled by deck. */
const sentCard = async (/** @type {string} */ id) =>
  (await material()).cards.flatMap((/** @type {any} */ b) => b.cards).find((/** @type {any} */ c) => c.id === id);
const SET = { wording: { question: "Who is this person to you?" }, lists: [hanoi.id], named: [], order: "after" };

/* Personal sets are off in a space until the App admin switches them on
   (0.683): only they may, and only a new set is refused while off. */
test("a space offers no personal sets until the App admin switches them on", async () => {
  const card = async () => (await raw("/api/courses?action=whoami", { key: teacher.key })).json.user.org;
  assert.equal((await card()).sets, false, "off by default");
  const refused = await post("save-set", teacher.key, { deckId: family.id, set: SET });
  assert.equal(refused.status, 403, refused.text);
  assert.equal(refused.json.error, "sets-off");
  const notTheirs = await post("admin-update-org", teacher.key, { id: "main", sets: true });
  assert.equal(notTheirs.status, 403, "a teacher cannot switch them on");
  const on = await post("admin-update-org", owner.key, { id: "main", sets: true });
  assert.equal(on.status, 200, on.text);
  assert.equal((await card()).sets, true);
});

test("a teacher saves a set on a deck, and a student of the course receives it", async () => {
  const r = await post("save-set", teacher.key, { deckId: family.id, set: SET });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.deck.set.lists, [hanoi.id]);
  const d = await sentDeck(family.id);
  assert.equal(d.set.order, "after");
  assert.deepEqual(d.set.lists, [hanoi.id]);
  assert.equal(d.set.wording.none, "I don't know this person", "with the default where nothing was written");
  assert.equal((await sentDeck(hanoi.id)).set, undefined);
});

test("saving it again moves the material's version", async () => {
  const before = (await material()).version;
  await post("save-set", teacher.key, { deckId: family.id, set: { ...SET, order: "before" } });
  const m = await material();
  assert.notEqual(m.version, before);
  const unchanged = await raw(`/api/courses?action=my-material&version=${m.version}`, { key: student.key });
  assert.equal(unchanged.json.unchanged, true);
});

test("a student cannot save one", async () => {
  const r = await post("save-set", student.key, { deckId: family.id, set: SET });
  assert.equal(r.status, 403);
});

test("a deck in My space is refused", async () => {
  const mine = (await post("create-deck", teacher.key, { title: "Mine", lang: "ar-PS", personal: true })).json.deck;
  const r = await post("save-set", teacher.key, { deckId: mine.id, set: SET });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "personal-set");
});

test("it survives a change of the deck's title and cards", async () => {
  await post("save-set", teacher.key, { deckId: family.id, set: SET });
  await post("rename-deck", teacher.key, { deckId: family.id, title: "My family" });
  await post("save-card", teacher.key, { card: { id: "", lang: "ar-PS", forms: [{ ar: "لان", en: "Lan", lat: "lan" }] }, decks: [family.id], publish: true });
  const d = await sentDeck(family.id);
  assert.equal(d.title, "My family");
  assert.deepEqual(d.set.lists, [hanoi.id]);
  assert.equal(d.cardCount, 1);
});

test("null makes it an ordinary deck again", async () => {
  const r = await post("save-set", teacher.key, { deckId: family.id, set: null });
  assert.equal(r.status, 200, r.text);
  assert.equal((await sentDeck(family.id)).set, undefined);
});

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

test("a card saved with who is speaking comes back with them, only for the recordings it has", async () => {
  const r = await post("save-card", teacher.key, {
    card: {
      id: "",
      lang: "ar-PS",
      forms: [{ ar: "عمة", en: "aunt", lat: "amma", clips: [A], slowClips: [B], voices: { [A]: "  Layla ", [B]: "", [C]: "Nobody" } }],
    },
    decks: [hanoi.id],
    publish: true,
  });
  assert.equal(r.status, 200, r.text);
  const id = r.json.card.id;
  const card = await sentCard(id);
  assert.deepEqual(card.forms[0].voices, { [A]: "Layla" });
});

test("a name is cut at forty characters, and a form with no names carries none", async () => {
  const r = await post("save-card", teacher.key, {
    card: { id: "", lang: "ar-PS", forms: [{ ar: "أب", en: "father", lat: "ab", clips: [A], voices: { [A]: "x".repeat(90) } }, { ar: "آباء", en: "fathers", lat: "aaba", clips: [B] }] },
    decks: [hanoi.id],
    publish: true,
  });
  const card = await sentCard(r.json.card.id);
  assert.equal(card.forms[0].voices[A].length, 40);
  assert.equal("voices" in card.forms[1], false);
});

test("switched off, a set is hidden from its teacher and its students, and comes back as it was", async () => {
  await post("save-set", teacher.key, { deckId: family.id, set: SET });
  const decksOf = async (/** @type {string} */ key) => (await raw("/api/courses?action=my-decks", { key })).json.decks.map((/** @type {any} */ d) => d.id);
  await post("admin-update-org", owner.key, { id: "main", sets: false });
  assert.equal(await sentDeck(family.id), undefined, "a student is not sent it");
  assert.ok(await sentDeck(hanoi.id), "its word list is an ordinary deck, and still sent");
  assert.ok(!(await decksOf(teacher.key)).includes(family.id), "its teacher does not see it");
  assert.ok((await decksOf(teacher.key)).includes(hanoi.id));
  const changed = await post("save-set", teacher.key, { deckId: family.id, set: { ...SET, order: "before" } });
  assert.equal(changed.status, 403, "nor can it be changed");
  await post("admin-update-org", owner.key, { id: "main", sets: true });
  assert.ok((await decksOf(teacher.key)).includes(family.id), "back for its teacher");
  const back = await sentDeck(family.id);
  assert.deepEqual(back && back.set.lists, [hanoi.id], "and for its students, as it was");
});
