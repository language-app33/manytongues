/*
 * A teacher's space kept on the device, and asked for again (0.580, audit
 * finding 17): an unchanged space is not written to storage again, and a
 * refresh that the server answers "nothing moved" leaves it as it is.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildOnce } from "./helpers.mjs";

/* The browser corners shared.tsx reaches for when it is loaded and used. */
const anyGlobal = /** @type {Record<string, any>} */ (/** @type {unknown} */ (globalThis));
/** @type {Map<string, string>} */
const held = new Map();
let writes = 0;
anyGlobal.window = anyGlobal.window || { location: { origin: "https://manytongues.test" } };
anyGlobal.localStorage = {
  getItem: (/** @type {string} */ k) => (held.has(k) ? held.get(k) : null),
  setItem: (/** @type {string} */ k, /** @type {string} */ v) => {
    writes += 1;
    held.set(k, String(v));
  },
  removeItem: (/** @type {string} */ k) => held.delete(k),
  key: (/** @type {number} */ i) => [...held.keys()][i] ?? null,
  get length() {
    return held.size;
  },
};

const dir = await buildOnce(["shared.tsx"]);
const shared = await import(path.join(dir, "shared.js"));

test("the same space delivered twice is written to the device once", () => {
  shared.forgetKeptSpaces();
  writes = 0;
  const shown = { courses: [], decks: [{ id: "d1" }], cards: [{ id: "k1" }] };
  shared.rememberSpace("teach", "nadia-0001", shown);
  shared.rememberSpace("teach", "nadia-0001", JSON.parse(JSON.stringify(shown)));
  assert.equal(writes, 1);
  /* A change is written. */
  shared.rememberSpace("teach", "nadia-0001", { ...shown, cards: [] });
  assert.equal(writes, 2);
  /* And somebody else's space, in the same slot, is never mistaken for it. */
  shared.rememberSpace("teach", "omar-0002", { ...shown, cards: [] });
  assert.equal(writes, 3);
  shared.rememberSpace("teach", "nadia-0001", { ...shown, cards: [] });
  assert.equal(writes, 4);
});

test("a refresh the server answers 'nothing moved' keeps the space and tells nobody", async () => {
  shared.forgetKeptSpaces();
  const shown = { courses: [{ id: "c1", role: "teacher" }], decks: [{ id: "d1" }], cards: [{ id: "k1" }] };
  const reply = (/** @type {number} */ status) => {
    anyGlobal.fetch = async (/** @type {string} */ url) => {
      const action = new URL(url).searchParams.get("action");
      const body = action === "my-courses" ? { ok: true, courses: shown.courses }
        : action === "my-decks" ? { ok: true, decks: shown.decks }
        : { ok: true, cards: shown.cards, missingClips: [] };
      return {
        ok: status < 300,
        status,
        headers: { get: (/** @type {string} */ h) => (h === "etag" ? `"${action}"` : "application/json") },
        text: async () => (status === 304 ? "" : JSON.stringify(body)),
      };
    };
  };
  reply(200);
  const first = await shared.pullTeaching("rana-0003");
  assert.equal(first.cards[0].id, "k1");
  writes = 0;
  reply(304);
  const again = await shared.pullTeaching("rana-0003");
  assert.equal(again.cards[0].id, "k1", "what was held stands");
  assert.equal(again.decks[0].id, "d1");
  assert.equal(writes, 0, "and nothing is written again");
});
