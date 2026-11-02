/*
 * Whose numbers a deck uses (0.541).
 *
 * A course with two teachers who both have numbers used to give its
 * students every number twice: the device filed every system it was sent
 * into every deck of that language. Now a deck names one source — its own
 * choice, or its owner — the server says which system that is on each deck
 * it sends, and the device files a system only into the decks that name it.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = await mkdtemp(path.join(tmpdir(), "manytongues-numbers-choice-"));
process.env.DATA_DIR = dir;
process.env.ADMIN_KEY = "numbers-choice-admin";
const { createApp } = await import("../server/index.js");
const { decksForSystem } = await import("../src/number-decks.ts");

const server = createApp();
await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
const at = /** @type {import("node:net").AddressInfo} */ (server.address());
const origin = `http://127.0.0.1:${at.port}`;
after(async () => {
  await new Promise((resolve) => server.close(() => resolve(undefined)));
  await rm(dir, { recursive: true, force: true });
});

/** @param {string} action @param {{ key?: string, body?: unknown, params?: Record<string, string> }} [o] */
async function api(action, { key, body, params } = {}) {
  const url = new URL(`${origin}/api/courses`);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const headers = /** @type {Record<string, string>} */ ({ "content-type": "application/json" });
  if (key) headers["x-key"] = key;
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

const system = () => ({
  id: "",
  languageId: "ar-PS",
  composerVersion: 1,
  lexemes: { "unit.1": { slot: "unit.1", forms: { standalone: "one" } } },
  overrides: {},
  nouns: [],
  audioPolicy: "components",
  rev: 0,
  created: 0,
  updated: 1000,
});

/** @param {string} name */
async function person(name) {
  const r = await api("signup", { body: { displayName: name } });
  return { key: r.json.key, handle: r.json.user.handle };
}

test("a deck's students get its chosen teacher's numbers, once", async () => {
  const admin = await person("Admin");
  assert.equal((await api("claim-admin", { key: admin.key, body: { adminKey: "numbers-choice-admin" } })).status, 200);
  const sara = await person("Sara");
  const tom = await person("Tom");
  const lina = await person("Lina");

  const course = (await api("create-course", { key: admin.key, body: { title: "Arabic", language: "ar-PS" } })).json.course;
  for (const t of [sara, tom]) await api("assign-teacher", { key: admin.key, body: { courseId: course.id, handle: t.handle } });
  await api("assign-student", { key: admin.key, body: { courseId: course.id, handle: lina.handle } });

  const saraSys = (await api("save-system", { key: sara.key, body: { kind: "numbers", system: system() } })).json.system;
  const tomSys = (await api("save-system", { key: tom.key, body: { kind: "numbers", system: system() } })).json.system;

  const deck = (await api("create-deck", { key: sara.key, body: { title: "Numbers", description: "", lang: "ar-PS" } })).json.deck;
  await api("attach-deck", { key: sara.key, body: { deckId: deck.id, courseId: course.id } });
  await api("set-deck-parts", { key: sara.key, body: { deckId: deck.id, parts: ["numbers:0-10"] } });

  /* Both teachers may be chosen; the owner first. */
  const sources = await api("number-sources", { key: sara.key, params: { deck: deck.id } });
  assert.equal(sources.status, 200);
  assert.deepEqual(sources.json.sources.map((/** @type {any} */ x) => x.handle), [sara.handle, tom.handle]);
  assert.equal(sources.json.chosen, sara.handle);

  /* By default, the owner's system alone is named on the deck. */
  let material = (await api("my-material", { key: lina.key })).json;
  let sent = material.decks.find((/** @type {any} */ d) => d.id === deck.id);
  assert.equal(sent.numbersSystemId, saraSys.id);

  /* Chosen otherwise, the deck names the other teacher's. */
  const set = await api("set-deck-numbers", { key: sara.key, body: { deckId: deck.id, from: tom.handle } });
  assert.equal(set.status, 200);
  material = (await api("my-material", { key: lina.key })).json;
  sent = material.decks.find((/** @type {any} */ d) => d.id === deck.id);
  assert.equal(sent.numbersSystemId, tomSys.id);

  /* Somebody who isn't a source is refused. */
  const bad = await api("set-deck-numbers", { key: sara.key, body: { deckId: deck.id, from: lina.handle } });
  assert.equal(bad.status, 400);
  /* And a student can't choose at all. */
  assert.equal((await api("number-sources", { key: lina.key, params: { deck: deck.id } })).status, 403);
});

test("a system is filed only into the decks that name it", () => {
  const decks = [
    { id: "a", title: "A", lang: "ar-PS", numbersSystemId: "n1" },
    { id: "b", title: "B", lang: "ar-PS", numbersSystemId: "n2" },
    { id: "c", title: "C", lang: "ar-PS", numbersSystemId: null },
    { id: "d", title: "D", lang: "ar-PS" },
    { id: "e", title: "E", lang: "vi-VN", numbersSystemId: "n1" },
  ];
  const ids = (/** @type {string} */ sys) =>
    decksForSystem(/** @type {any} */ (decks), "ar-PS", sys).map((d) => d.id);
  /* A deck without the field came from an older server and takes every
     system, as before; null takes none. */
  assert.deepEqual(ids("n1"), ["a", "d"]);
  assert.deepEqual(ids("n2"), ["b", "d"]);
});
