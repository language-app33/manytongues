/*
 * Recordings and pictures nothing names any more, cleared from the device
 * (0.580, audit finding 22).
 *
 * The smoke walk runs with IndexedDB taken away on purpose (it exercises
 * the fallback), so the sweep is tried here against the smallest stand-in
 * that does what the app asks of one: open, a transaction, an object
 * store's keys, and delete.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildOnce } from "./helpers.mjs";

/** @type {Record<string, Map<string, unknown>>} */
const stores = { clips: new Map(), images: new Map() };

/** A request that answers on the next turn, as IndexedDB's do. */
const answering = (/** @type {() => unknown} */ work) => {
  /** @type {any} */
  const req = { result: undefined, onsuccess: null, onerror: null };
  setTimeout(() => {
    req.result = work();
    if (req.onsuccess) req.onsuccess();
  }, 0);
  return req;
};
const db = {
  objectStoreNames: { contains: (/** @type {string} */ n) => n in stores },
  createObjectStore: (/** @type {string} */ n) => (stores[n] = stores[n] || new Map()),
  transaction: (/** @type {string} */ name) => ({
    objectStore: () => {
      const st = stores[name];
      return {
        getAllKeys: () => answering(() => [...st.keys()]),
        get: (/** @type {string} */ k) => answering(() => st.get(k)),
        getKey: (/** @type {string} */ k) => answering(() => (st.has(k) ? k : undefined)),
        put: (/** @type {unknown} */ v, /** @type {string} */ k) => answering(() => (st.set(k, v), k)),
        delete: (/** @type {string} */ k) => answering(() => (st.delete(k), undefined)),
        clear: () => answering(() => (st.clear(), undefined)),
      };
    },
  }),
};
const anyGlobal = /** @type {Record<string, any>} */ (/** @type {unknown} */ (globalThis));
anyGlobal.indexedDB = {
  open: () => answering(() => db),
};

const dir = await buildOnce(["ArabicTrainer.tsx"]);
const { sweepMedia, mediaOf } = await import(path.join(dir, "ArabicTrainer.js"));

test("what the cards name stays; what nothing names goes", async () => {
  stores.clips.set("rec-kept", "a");
  stores.clips.set("rec-gone", "b");
  stores.images.set("img-kept", "c");
  stores.images.set("img-gone", "d");
  const items = [{
    id: "k1", kind: "word", tags: [], created: 0, updated: 0,
    forms: [{ id: "k1-f", ar: "بيت", en: "house", lat: "beit", recs: [{ id: "rec-kept" }], images: ["img-kept"] }],
  }];
  const named = mediaOf(items);
  assert.deepEqual([...named.clips], ["rec-kept"]);
  assert.deepEqual([...named.images], ["img-kept"]);
  const gone = await sweepMedia(named);
  assert.equal(gone, 2);
  assert.deepEqual([...stores.clips.keys()], ["rec-kept"]);
  assert.deepEqual([...stores.images.keys()], ["img-kept"]);
});
