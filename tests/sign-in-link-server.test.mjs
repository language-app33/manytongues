/*
 * Sign-in links are for students only (0.638).
 *
 * The server says who is "key only" (teaches a course, runs a space or is
 * the App admin) on the answers that already exist, and refuses a key-only
 * account that says it came by a link (`via=link`) with `key-only`. A new
 * key kills the old link, because the link is only the key.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = await mkdtemp(path.join(tmpdir(), "manytongues-link-"));
process.env.DATA_DIR = dir;
process.env.ADMIN_KEY = "link-admin";
const { createApp } = await import("../server/index.js");

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
 * @param {{ key?: string, body?: unknown, params?: Record<string, string>, org?: string }} [o]
 */
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

/** @param {string} name */
async function signup(name) {
  const r = await api("signup", { body: { displayName: name } });
  assert.equal(r.status, 200);
  return { key: r.json.key, handle: r.json.user.handle };
}

/** whoami, plainly or as if from a sign-in link. */
const whoami = (/** @type {string} */ key, viaLink = false, org = "") =>
  api("whoami", { key, params: { ...(viaLink ? { via: "link" } : {}), ...(org ? { org } : {}) } });

/* ---------------------------------------------------------------- setup */

const admin = await signup("Owner");
assert.equal((await api("claim-admin", { key: admin.key, body: { adminKey: "link-admin" } })).status, 200);

const made = await api("admin-create-org", { key: admin.key, body: { name: "Lingua", slug: "lingua", adminName: "Rana" } });
assert.equal(made.status, 200, JSON.stringify(made.json));
const B = made.json.org.id;
const bAdmin = { key: made.json.key, handle: made.json.admin.handle };

const course = (await api("create-course", { key: admin.key, body: { title: "Main course", language: "ar-PS" } })).json.course;
const bCourse = (await api("create-course", { key: admin.key, org: B, body: { title: "B course", language: "ar-PS" } })).json.course;

/* --------------------------------------------------------------- tests */

test("a student may come by a link", async () => {
  const r = await api("admin-create-user", { key: admin.key, body: { displayName: "Lina", courseId: course.id, roles: ["student"] } });
  assert.equal(r.status, 200);
  assert.equal(r.json.keyOnly, false);
  assert.equal(r.json.slug, "main");
  const plain = await whoami(r.json.key);
  assert.equal(plain.status, 200);
  assert.equal(plain.json.user.keyOnly, false);
  const link = await whoami(r.json.key, true);
  assert.equal(link.status, 200);
  assert.equal(link.json.user.keyOnly, false);
});

test("a teacher is key only: the key works, a link is refused", async () => {
  const r = await api("admin-create-user", { key: admin.key, body: { displayName: "Tariq", courseId: course.id, roles: ["teacher"] } });
  assert.equal(r.status, 200);
  assert.equal(r.json.keyOnly, true);
  const plain = await whoami(r.json.key);
  assert.equal(plain.status, 200);
  assert.equal(plain.json.user.keyOnly, true);
  const link = await whoami(r.json.key, true);
  assert.equal(link.status, 403);
  assert.equal(link.json.error, "key-only");
});

test("a space admin and the App admin are key only", async () => {
  for (const who of [bAdmin, admin]) {
    const plain = await whoami(who.key);
    assert.equal(plain.status, 200);
    assert.equal(plain.json.user.keyOnly, true);
    const link = await whoami(who.key, true);
    assert.equal(link.status, 403);
    assert.equal(link.json.error, "key-only");
  }
});

test("teaching in another space counts, whatever space is asked for", async () => {
  const r = await api("admin-create-user", { key: admin.key, body: { displayName: "Sami", courseId: course.id, roles: ["student"] } });
  const sami = { key: r.json.key, handle: r.json.user.handle };
  assert.equal((await whoami(sami.key, true)).status, 200);
  /* Into B as well, then made a teacher there. */
  const joined = await api("join-space", { key: sami.key, body: { code: made.json.org.inviteCode } });
  assert.equal(joined.status, 200, JSON.stringify(joined.json));
  const assigned = await api("assign-teacher", { key: admin.key, org: B, body: { courseId: bCourse.id, handle: sami.handle } });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.json));
  const link = await whoami(sami.key, true, "main");
  assert.equal(link.status, 403);
  assert.equal(link.json.error, "key-only");
  const plain = await whoami(sami.key, false, "main");
  assert.equal(plain.status, 200);
  assert.equal(plain.json.user.org.id, "main");
  assert.equal(plain.json.user.keyOnly, true);
});

test("a new key kills the old link and answers the space's address", async () => {
  const r = await api("admin-create-user", { key: admin.key, org: B, body: { displayName: "Huda", courseId: bCourse.id, roles: ["student"] } });
  assert.equal(r.json.slug, "lingua");
  const old = r.json.key;
  const again = await api("admin-reissue-key", { key: admin.key, org: B, body: { handle: r.json.user.handle } });
  assert.equal(again.status, 200, JSON.stringify(again.json));
  assert.equal(again.json.keyOnly, false);
  assert.equal(again.json.slug, "lingua");
  const stale = await whoami(old, true);
  assert.equal(stale.status, 401);
  assert.equal(stale.json.error, "bad-key");
  assert.equal((await whoami(again.json.key, true)).status, 200);
});

test("a student made a teacher is refused by link from then on, with the same key", async () => {
  const r = await api("admin-create-user", { key: admin.key, body: { displayName: "Omar" } });
  const omar = { key: r.json.key, handle: r.json.user.handle };
  assert.equal(r.json.keyOnly, false);
  assert.equal((await whoami(omar.key, true)).status, 200);
  const assigned = await api("assign-teacher", { key: admin.key, body: { courseId: course.id, handle: omar.handle } });
  assert.equal(assigned.status, 200);
  const link = await whoami(omar.key, true);
  assert.equal(link.status, 403);
  assert.equal(link.json.error, "key-only");
});

test("signing up with a teacher's course code is key only; a student's is not", async () => {
  assert.ok(course.code && course.teacherCode, "create-course answers both codes");
  const asStudent = await api("signup", { body: { displayName: "Nadia", code: course.code } });
  assert.equal(asStudent.status, 200);
  assert.equal(asStudent.json.user.keyOnly, false);
  const asTeacher = await api("signup", { body: { displayName: "Faris", code: course.teacherCode } });
  assert.equal(asTeacher.status, 200);
  assert.equal(asTeacher.json.user.keyOnly, true);
});

/* ------------------------------------------- a link's own code (0.640) */

const { createHash } = await import("node:crypto");
const { getStore } = await import("../server/store.js");
const digest = (/** @type {string} */ s) => createHash("sha256").update(s).digest("hex");
const SHAPE = /^[a-z0-9]+(-[a-z0-9]+){2,7}$/;

test("a student's link carries a code of its own, which signs in to the same practice", async () => {
  const r = await api("admin-create-user", { key: admin.key, body: { displayName: "Rima", courseId: course.id, roles: ["student"] } });
  const code = r.json.linkKey;
  assert.match(code, SHAPE);
  assert.notEqual(code, r.json.key);
  const viaLink = await whoami(code, true);
  assert.equal(viaLink.status, 200);
  assert.equal(viaLink.json.user.handle, r.json.user.handle);
  assert.equal(viaLink.json.user.syncToken, digest(r.json.key), "the practice is kept under the key's digest");
  assert.equal(viaLink.json.user.linkKey, code);
  /* Typed into the key box, it works as well. */
  assert.equal((await whoami(code)).status, 200);
  /* And the record sent out never carries the digests. */
  assert.equal(viaLink.json.user.linkHash, undefined);
  assert.equal(viaLink.json.user.keyHash, undefined);
});

test("a student made before links gets one without their key changing", async () => {
  const r = await api("admin-create-user", { key: admin.key, body: { displayName: "Zaid", courseId: course.id, roles: ["student"] } });
  const handle = r.json.user.handle;
  /* As an account from before 0.640 is stored: no link. */
  const store = getStore("arabic-courses");
  const rec = JSON.parse(String(await store.get(`user:${handle}`, { type: "text" })));
  await store.delete(`key:${rec.linkHash}`).catch(() => {});
  delete rec.linkHash;
  delete rec.linkN;
  await store.set(`user:${handle}`, JSON.stringify(rec));
  assert.equal((await whoami(r.json.linkKey, true)).status, 401, "the link is gone");
  const people = (await api("admin-overview", { key: admin.key })).json;
  const row = people.users.find((/** @type {any} */ u) => u.handle === handle);
  assert.match(row.linkKey, SHAPE);
  assert.equal(people.linkSlug, "main");
  assert.equal((await whoami(row.linkKey, true)).status, 200, "the link made for them works");
  assert.equal((await whoami(r.json.key)).status, 200, "and so does their key, unchanged");
});

test("a new key makes a new link and ends the old one", async () => {
  const r = await api("admin-create-user", { key: admin.key, body: { displayName: "Yara", courseId: course.id, roles: ["student"] } });
  const again = await api("admin-reissue-key", { key: admin.key, body: { handle: r.json.user.handle } });
  assert.match(again.json.linkKey, SHAPE);
  assert.notEqual(again.json.linkKey, r.json.linkKey);
  assert.equal((await whoami(r.json.linkKey, true)).status, 401);
  const fresh = await whoami(again.json.linkKey, true);
  assert.equal(fresh.status, 200);
  assert.equal(fresh.json.user.syncToken, digest(again.json.key));
});

test("teachers and admins have no link, and a student made a teacher loses theirs", async () => {
  const t = await api("admin-create-user", { key: admin.key, body: { displayName: "Karim", courseId: course.id, roles: ["teacher"] } });
  assert.equal(t.json.linkKey, "");
  assert.equal((await whoami(t.json.key)).json.user.linkKey, "");
  const s = await api("admin-create-user", { key: admin.key, body: { displayName: "Dana" } });
  const code = s.json.linkKey;
  assert.equal((await whoami(code)).status, 200);
  await api("assign-teacher", { key: admin.key, body: { courseId: course.id, handle: s.json.user.handle } });
  const refused = await whoami(code);
  assert.equal(refused.status, 403, "refused even when the app does not say it came by link");
  assert.equal(refused.json.error, "key-only");
  assert.equal((await whoami(code)).status, 401, "and the code is gone after that");
  assert.equal((await whoami(s.json.key)).status, 200, "their key still works");
});

test("a space admin sees the links of their own students, and nobody else's", async () => {
  const s = await api("admin-create-user", { key: bAdmin.key, body: { displayName: "Laila", courseId: bCourse.id, roles: ["student"] } });
  assert.match(s.json.linkKey, SHAPE);
  const seen = (await api("admin-overview", { key: bAdmin.key })).json;
  assert.equal(seen.linkSlug, "lingua");
  const row = (/** @type {string} */ h) => seen.users.find((/** @type {any} */ u) => u.handle === h);
  assert.equal(row(s.json.user.handle).linkKey, s.json.linkKey);
  assert.equal(row(bAdmin.handle).linkKey, "", "a space admin has none");
  const everyone = (await api("admin-everyone", { key: admin.key })).json.people;
  const laila = everyone.find((/** @type {any} */ u) => u.handle === s.json.user.handle);
  assert.equal(laila.linkKey, s.json.linkKey);
  assert.equal(laila.linkSlug, "lingua");
  assert.equal(everyone.find((/** @type {any} */ u) => u.handle === admin.handle).linkKey, "");
});
