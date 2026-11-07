/*
 * A space's contents held on the device are the contents of one space
 * (0.582). An App admin opens a space at its address, and until the address
 * lookup has said which space that is, a request acts in their own first
 * space instead. What that answers must never stand in for the space on
 * screen — neither straight away, nor later, when the server says "nothing
 * moved" and the app reaches for what it holds.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildOnce } from "./helpers.mjs";

const anyGlobal = /** @type {Record<string, any>} */ (/** @type {unknown} */ (globalThis));
/** @type {Map<string, string>} */
const held = new Map();
anyGlobal.window = anyGlobal.window || { location: { origin: "https://manytongues.test" } };
anyGlobal.localStorage = {
  getItem: (/** @type {string} */ k) => (held.has(k) ? held.get(k) : null),
  setItem: (/** @type {string} */ k, /** @type {string} */ v) => held.set(k, String(v)),
  removeItem: (/** @type {string} */ k) => held.delete(k),
  key: (/** @type {number} */ i) => [...held.keys()][i] ?? null,
  get length() {
    return held.size;
  },
};

/* One bundle for both, so the space header the API sends is the one the
   test sets. */
const dir = await buildOnce(["shared.tsx", "courses-api.ts"], { splitting: true });
const shared = await import(path.join(dir, "shared.js"));
const API = await import(path.join(dir, "courses-api.js"));

/* A server with two spaces: "lingua", holding decks, and the admin's own
   first space, holding none. It answers by the space header, and 304 when
   the ETag it is shown is the one it would send. */
function serve() {
  anyGlobal.fetch = async (/** @type {string} */ url, /** @type {any} */ init) => {
    const action = new URL(url).searchParams.get("action");
    const org = (init && init.headers && init.headers["x-org"]) || "";
    const body = action === "admin-overview"
      ? { ok: true, decks: org === "lingua" ? [{ id: "d1" }, { id: "d2" }] : [], courses: [], users: [], flags: [] }
      : action === "my-decks" ? { ok: true, decks: org === "lingua" ? [{ id: "d1" }] : [] }
      : action === "my-courses" ? { ok: true, courses: [] }
      : { ok: true, cards: org === "lingua" ? [{ id: "k1" }] : [], missingClips: [] };
    const etag = `"${action}:${org}"`;
    const unchanged = init && init.headers && init.headers["if-none-match"] === etag;
    return {
      ok: true,
      status: unchanged ? 304 : 200,
      headers: { get: (/** @type {string} */ h) => (h === "etag" ? etag : "application/json") },
      text: async () => (unchanged ? "" : JSON.stringify(body)),
    };
  };
}

test("Admin: an answer for the admin's own space never stands in for the space on screen", async () => {
  shared.forgetKeptSpaces();
  API.forgetEtags();
  serve();
  API.setAddressOrg("lingua");
  const first = await shared.pullAdmin("owner-0001");
  assert.equal(first.decks.length, 2);

  /* A request that left before the address was known, answered late. */
  API.setAddressOrg("");
  await shared.pullAdmin("owner-0001");

  /* Back in the space: the server says nothing has moved there. */
  API.setAddressOrg("lingua");
  const again = await shared.pullAdmin("owner-0001");
  assert.equal(again.decks.length, 2, "the space's own decks, not the other space's");
});

test("Teaching: the same", async () => {
  shared.forgetKeptSpaces();
  API.forgetEtags();
  serve();
  API.setAddressOrg("lingua");
  const first = await shared.pullTeaching("owner-0001");
  assert.equal(first.cards.length, 1);
  API.setAddressOrg("");
  await shared.pullTeaching("owner-0001");
  API.setAddressOrg("lingua");
  const again = await shared.pullTeaching("owner-0001");
  assert.equal(again.cards.length, 1, "the space's own cards, not the other space's");
  assert.equal(again.decks.length, 1);
});
