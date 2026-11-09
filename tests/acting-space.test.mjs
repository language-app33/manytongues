/*
 * One acting space for every request (0.582).
 *
 * Every request says which space it acts in. A member's is known from the
 * account at once; an App admin at another space's address waits for the
 * address lookup rather than leaving without it, because a request without
 * it acts in the admin's own first space.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildOnce } from "./helpers.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const anyGlobal = /** @type {Record<string, any>} */ (/** @type {unknown} */ (globalThis));
/** @type {Map<string, string>} */
const held = new Map();
anyGlobal.window = { location: { origin: "https://manytongues.test", pathname: "/" } };
anyGlobal.localStorage = {
  getItem: (/** @type {string} */ k) => (held.has(k) ? held.get(k) : null),
  setItem: (/** @type {string} */ k, /** @type {string} */ v) => held.set(k, String(v)),
  removeItem: (/** @type {string} */ k) => held.delete(k),
  key: (/** @type {number} */ i) => [...held.keys()][i] ?? null,
  get length() {
    return held.size;
  },
};

const dir = await buildOnce(["shared.tsx", "courses-api.ts"], { splitting: true });
await import(path.join(dir, "shared.js"));
const API = await import(path.join(dir, "courses-api.js"));

/** @type {{ action: string | null, org: string | undefined }[]} */
let sent = [];
function serve() {
  sent = [];
  anyGlobal.fetch = async (/** @type {string} */ url, /** @type {any} */ init) => {
    const action = new URL(url).searchParams.get("action");
    sent.push({ action, org: init && init.headers ? init.headers["x-org"] : undefined });
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ ok: true, decks: [] }),
    };
  };
}
const tick = () => new Promise((r) => setTimeout(r, 10));
const at = (/** @type {string} */ p) => {
  anyGlobal.window.location.pathname = p;
};
const main = { id: "main", slug: "main" };
const lingua = { id: "lingua", slug: "lingua" };

/** @param {boolean} admin @param {any[]} orgs */
function signIn(admin, orgs) {
  API.setAddressOrg("");
  API.forgetEtags();
  API.saveAccount({ handle: "nadia-0001", key: "k-1", admin, org: orgs[0], orgs });
}

test("a member in two spaces at one of their addresses sends that space from the first request", async () => {
  signIn(false, [main, lingua]);
  serve();
  at("/lingua");
  await API.myDecks();
  assert.equal(sent[0].org, "lingua");
  at("/");
  await API.myDecks();
  assert.equal(sent[1].org, "main");
});

test("an App admin at another space's address waits for the lookup", async () => {
  signIn(true, [main]);
  serve();
  at("/lingua");
  const going = API.myDecks();
  await tick();
  assert.equal(sent.length, 0, "nothing leaves before the space is known");
  API.setAddressOrg("lingua");
  await going;
  assert.equal(sent[0].org, "lingua");
});

test("a failed lookup fails the waiting request, and the next one waits again", async () => {
  signIn(true, [main]);
  serve();
  at("/lingua");
  const first = API.myDecks();
  API.spaceLookupFailed(new Error("offline"));
  await assert.rejects(first, /offline/);
  let done = false;
  const second = API.myDecks().then(() => {
    done = true;
  });
  await tick();
  assert.equal(done, false, "still waiting for the next attempt");
  API.setAddressOrg("lingua");
  await second;
  assert.equal(done, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].org, "lingua");
});

test("anonymous calls do not wait", async () => {
  signIn(true, [main]);
  serve();
  at("/lingua");
  await API.orgInfo("lingua");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].org, undefined);
});

test("an App admin at their own address or the plain one does not wait", async () => {
  signIn(true, [main]);
  serve();
  at("/main");
  await API.myDecks();
  at("/");
  await API.myDecks();
  assert.deepEqual(sent.map((s) => s.org), ["main", undefined]);
});

test("signing out forgets the account the requests were keyed by", async () => {
  signIn(true, [main]);
  at("/lingua");
  assert.equal(API.actingSpace(), null);
  API.clearAccount();
  assert.equal(API.actingSpace(), "");
});

test("whether somebody teaches is kept per space", () => {
  const src = fs.readFileSync(path.join(here, "..", "src", "ArabicTrainer.tsx"), "utf8");
  assert.match(src, /const teachesKey = \(\) => `\$\{TEACHES_PREFIX\}\$\{API\.currentOrg\(\)\}`/);
  assert.doesNotMatch(src, /localStorage\.(get|set)Item\(TEACHES_KEY/);
});

test("at an address that is no space, every request fails with that", async () => {
  signIn(true, [main]);
  serve();
  at("/nowhere");
  const first = API.myDecks();
  API.spaceLookupFailed(new Error("no-space"));
  await assert.rejects(first, /no-space/);
  await assert.rejects(API.myDecks(), /no-space/);
  assert.equal(sent.length, 0);
  API.setAddressOrg("");
});
