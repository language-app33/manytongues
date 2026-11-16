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
