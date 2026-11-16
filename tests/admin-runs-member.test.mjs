/*
 * A space the App admin runs is one of their spaces (0.637).
 *
 * From 0.552 to 0.636, "I'll be this space's admin" put the App admin on
 * the new space's admins without making them a member, so the space was
 * missing from their own list and they had no way into it. This file
 * starts from a site already in that state, written straight to the store
 * the way 0.636 left it, and checks the first sign-in repairs it once.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = await mkdtemp(path.join(tmpdir(), "manytongues-runs-"));
process.env.DATA_DIR = dir;
process.env.ADMIN_KEY = "runs-admin";
const { createApp } = await import("../server/index.js");
const { getStore } = await import("../server/store.js");

const server = createApp();
await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
const at = /** @type {import("node:net").AddressInfo} */ (server.address());
const origin = `http://127.0.0.1:${at.port}`;
after(async () => {
  await new Promise((resolve) => server.close(() => resolve(undefined)));
  await rm(dir, { recursive: true, force: true });
});

/**
 * @param {string} action
 * @param {{ key?: string, body?: unknown }} [o]
 */
async function api(action, { key, body } = {}) {
  const res = await fetch(`${origin}/api/courses?action=${action}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(key ? { "x-key": key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

test("a space the App admin was made admin of, but not put in, is theirs after signing in", async () => {
  const owner = await api("signup", { body: { displayName: "Owner" } });
  assert.equal(owner.status, 200, JSON.stringify(owner.json));
  const key = owner.json.key;
  const handle = owner.json.user.handle;
  assert.equal((await api("claim-admin", { key, body: { adminKey: "runs-admin" } })).status, 200);

  /* The state 0.636 left: a space naming them as admin, and an account
     not in it. Written directly, before anything signs in. */
  const store = getStore("arabic-courses");
  const id = "ostuck000001";
  await store.set(`org:${id}`, JSON.stringify({
    id, slug: "stuck", formerSlugs: [], name: "Stuck", logo: "", colour: "",
    admins: [handle], inviteCode: "stuckcode", created: Date.now(),
  }));
  const index = JSON.parse(String((await store.get("index:orgs", { type: "text" })) || "[]"));
  await store.set("index:orgs", JSON.stringify(index.concat([id])));

  const who = await api("whoami", { key });
  assert.equal(who.status, 200, JSON.stringify(who.json));
  const listed = who.json.user.orgs.find((/** @type {any} */ o) => o.id === id);
  assert.ok(listed, "the space they run is in their own list");
  assert.equal(listed.runs, true);
});
