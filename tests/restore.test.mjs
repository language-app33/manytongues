/*
 * A space's backup, and a restore that cannot lose anything (0.583;
 * docs/PLAN-space-backup.md, B8). One test per rule, against the real API on
 * a scratch store.
 *
 * Its own file, and so its own data directory and its own process: the
 * tests below delete spaces, clear the site and restore it, which no other
 * file's tests could share a store with.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

const dir = await mkdtemp(path.join(tmpdir(), "manytongues-restore-"));
process.env.DATA_DIR = dir;
const ADMIN_KEY = "restore-admin";
process.env.ADMIN_KEY = ADMIN_KEY;
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

const sha = (/** @type {string} */ s) => createHash("sha256").update(s).digest("hex");

/**
 * @param {string} action
 * @param {{ key?: string, body?: unknown, params?: Record<string, string>, org?: string }} [o]
 */
async function api(action, { key, body, params, org } = {}) {
  const url = new URL(`${origin}/api/courses`);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  /** @type {Record<string, string>} */
  const headers = { "content-type": "application/json" };
  if (key) headers["x-key"] = key;
  if (org) headers["x-org"] = org;
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  /** @type {any} */
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = null;
  }
  return { status: res.status, json, text };
}

/**
 * The sync endpoint, by token.
 * @param {string} token
 * @param {{ method?: string, body?: unknown, audio?: string }} [o]
 */
async function sync(token, { method = "GET", body, audio } = {}) {
  const url = new URL(`${origin}/api/sync`);
  if (audio) url.searchParams.set("audio", audio);
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json", "x-sync-token": token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

const card = (/** @type {string} */ word, /** @type {Record<string, any>} */ over = {}) => ({
  id: "",
  lang: "ar-PS",
  forms: [{ ar: word, en: word, lat: word }],
  ...over,
});

const store = getStore("arabic-courses");
const raw = async (/** @type {string} */ k) => {
  const t = await store.get(k, { type: "text" });
  return t == null ? null : JSON.parse(String(t));
};
const text = async (/** @type {string} */ k) => store.get(k, { type: "text" });

/* ---------------------------------------------------------------- setup */

const first = await api("signup", { body: { displayName: "Owner" } });
const admin = { key: first.json.key, handle: first.json.user.handle };
assert.equal((await api("claim-admin", { key: admin.key, body: { adminKey: ADMIN_KEY } })).status, 200);

/** A new space with an admin. */
async function space(/** @type {string} */ name, /** @type {string} */ slug) {
  const made = await api("admin-create-org", { key: admin.key, body: { name, slug, adminName: `${name} admin` } });
  assert.equal(made.status, 200, made.text);
  return /** @type {string} */ (made.json.org.id);
}

/** A course in a space, with a teacher and a student, and a deck holding one card. */
async function classroom(/** @type {string} */ tag, /** @type {string | undefined} */ org) {
  const course = (await api("create-course", { key: admin.key, org, body: { title: `Course ${tag}`, language: "ar-PS" } })).json.course;
  const made = async (/** @type {string} */ role, /** @type {string} */ name) => {
    const r = await api("admin-create-user", {
      key: admin.key, org, body: { displayName: `${name} ${tag}`, courseId: course.id, roles: [role] },
    });
    assert.equal(r.status, 200, r.text);
    return { key: /** @type {string} */ (r.json.key), handle: /** @type {string} */ (r.json.user.handle) };
  };
  const teacher = await made("teacher", "teacher");
  const student = await made("student", "student");
  const other = await made("student", "other");
  const deck = (await api("create-deck", { key: teacher.key, org, body: { title: `Deck ${tag}`, lang: "ar-PS" } })).json.deck;
  assert.equal((await api("attach-deck", { key: teacher.key, org, body: { deckId: deck.id, courseId: course.id } })).status, 200);
  const saved = await api("save-card", { key: teacher.key, org, body: { card: card(`word-${tag}`), decks: [deck.id] } });
  assert.equal(saved.status, 200, saved.text);
  const second = await api("save-card", { key: teacher.key, org, body: { card: card(`more-${tag}`), decks: [deck.id] } });
  assert.equal(second.status, 200, second.text);
  return { course, teacher, student, other, deck, card: saved.json.card, card2: second.json.card };
}

/** A whole file, as the app builds one: records in plan order, the indexes beside. */
async function takeBackup(/** @type {string} */ only = "") {
  const got = only
    ? await api("admin-export-org-manifest", { key: admin.key, body: { id: only } })
    : await api("admin-backup-manifest", { key: admin.key });
  assert.equal(got.status, 200, got.text);
  const manifest = got.json.manifest;
  /** @type {Record<string, any>} */
  const records = {};
  for (const c of manifest.plan) {
    const r = await api("admin-backup-chunk", { key: admin.key, body: { keys: c.keys } });
    assert.equal(r.status, 200, r.text);
    Object.assign(records, r.json.records);
  }
  return { manifest, records };
}

/** The options the app sends with every request of one restore. */
function optionsFor(/** @type {any} */ file, /** @type {Record<string, any>} */ more = {}) {
  const scope = file.manifest.scope && file.manifest.scope.kind === "space"
    ? { kind: "space", space: file.manifest.scope.space }
    : { kind: "site" };
  /** @type {Record<string, number>} */
  const created = {};
  for (const [k, v] of Object.entries(file.records)) if (k.startsWith("user:") && v && v.created) created[k.slice(5)] = v.created;
  return { scope, fileOrgs: file.manifest.indexes.orgs || [], created, bringBack: [], ...more };
}

/** Puts a file back, in the app's order: records, then indexes. */
async function restore(/** @type {any} */ file, /** @type {Record<string, any>} */ more = {}) {
  const options = optionsFor(file, more);
  const keys = Object.keys(file.records);
  /** @type {Record<string, any>[]} */
  const batches = [];
  for (let i = 0; i < keys.length; i += 150) {
    batches.push(Object.fromEntries(keys.slice(i, i + 150).map((k) => [k, file.records[k]])));
  }
  batches.push(Object.fromEntries(Object.entries(file.manifest.indexes || {}).map(([w, l]) => [`index:${w}`, l])));
  let written = 0;
  let merged = 0;
  /** @type {{ key: string, why: string }[]} */
  const skipped = [];
  let sent = 0;
  for (const b of batches) {
    sent += Object.keys(b).length;
    const r = await api("admin-restore-chunk", { key: admin.key, body: { records: b, options } });
    assert.equal(r.status, 200, r.text);
    written += r.json.written;
    merged += r.json.merged;
    skipped.push(...r.json.skipped);
  }
  return { written, merged, skipped, sent, why: (/** @type {string} */ k) => (skipped.find((s) => s.key === k) || {}).why };
}

/** What the preview says, from the fields the app sends. */
async function preview(/** @type {any} */ file, /** @type {Record<string, any>} */ more = {}) {
  const r = file.records;
  const of = (/** @type {string} */ p) => Object.keys(r).filter((k) => k.startsWith(p));
  const r2 = await api("admin-restore-preview", {
    key: admin.key,
    body: {
      options: optionsFor(file, more),
      users: of("user:").map((k) => ({ handle: k.slice(5), created: r[k].created, orgs: r[k].orgs, org: r[k].org, displayName: r[k].displayName })),
      courses: of("course:").map((k) => ({ id: r[k].id, org: r[k].org, title: r[k].title, teachers: r[k].teachers, students: r[k].students })),
      orgs: of("org:").map((k) => ({ id: r[k].id, slug: r[k].slug, name: r[k].name })),
      keys: {
        cards: of("card:").map((k) => k.slice(5)), decks: of("deck:").map((k) => k.slice(5)),
        courses: of("course:").map((k) => k.slice(7)), flags: of("flag:").map((k) => k.slice(5)),
      },
    },
  });
  assert.equal(r2.status, 200, r2.text);
  return r2.json;
}
const handlesIn = (/** @type {any[]} */ list) => list.map((p) => p.handle).sort();

/* Space B: a classroom, a teacher from Main who also teaches in B, and that
   teacher's My space in B. */
const B = await space("Bee", "bee-hive");
const roomB = await classroom("b", B);
const home = await classroom("home", undefined);
const joined = await api("join-course", { key: home.teacher.key, org: B, body: { code: (await raw(`course:${roomB.course.id}`)).teacherCode } });
assert.equal(joined.status, 200, joined.text);
const visitorDeck = (await api("create-deck", { key: home.teacher.key, org: B, body: { title: "Mine in B", lang: "ar-PS", personal: true } })).json.deck;
const visitorCard = (await api("save-card", { key: home.teacher.key, org: B, body: { card: card("mine-b"), decks: [], personal: true } })).json.card;
const mainOnlyDeck = (await api("create-deck", { key: home.teacher.key, body: { title: "Mine in Main", lang: "ar-PS", personal: true } })).json.deck;
/* The visiting teacher has practised, with one recording of their own. */
const visitorToken = sha(home.teacher.key);
assert.equal((await sync(visitorToken, { method: "POST", body: { data: { items: [{ id: "p1", updated: 1, forms: [{ ar: "x", recs: [{ id: "rec1" }] }] }] } } })).status, 200);
assert.equal((await sync(visitorToken, { method: "POST", audio: "rec1", body: { data: "AUDIO-1" } })).status, 200);

const fileB = await takeBackup(B);

/* ------------------------------------------------- stages 1 and 2: the file */

test("a space's file says whose it is, and holds its members' My space and practice", async () => {
  const planned = fileB.manifest.plan.flatMap((/** @type {any} */ c) => c.keys);
  assert.equal(fileB.manifest.scope.kind, "space");
  assert.equal(fileB.manifest.scope.space, B);
  assert.equal(fileB.manifest.scope.slug, "bee-hive");
  assert.ok(planned.includes(`deck:${visitorDeck.id}`), "the visitor's My space deck made in B");
  assert.ok(planned.includes(`card:${visitorCard.id}`), "and card");
  assert.ok(!planned.includes(`deck:${mainOnlyDeck.id}`), "but not their My space in Main");
  assert.ok(planned.includes(`progress:${home.teacher.handle}`), "the whole practice document of a member whose first space is Main");
  assert.ok(planned.includes(`paudio:${home.teacher.handle}:rec1`), "with its recording");
  assert.equal(JSON.parse(fileB.records[`progress:${home.teacher.handle}`]).items[0].id, "p1");
  assert.equal(fileB.records[`paudio:${home.teacher.handle}:rec1`], "AUDIO-1");
  /* How large each kind is, so the backup screen can say so (0.584). */
  assert.ok(fileB.manifest.bytes.card > 0, "the cards' size");
  assert.equal(fileB.manifest.bytes.paudio, Buffer.byteLength("AUDIO-1"), "a recording's size, from the practice store");
  assert.equal(fileB.manifest.bytes.progress, Buffer.byteLength(fileB.records[`progress:${home.teacher.handle}`]), "the practice document's");
  const site = await api("admin-backup-manifest", { key: admin.key });
  assert.equal(site.json.manifest.scope.kind, "site");
  assert.ok(site.json.manifest.counts.progress >= 1);
});

/* ------------------------------------------------------------- 1. kept */

test("an account in the space is left exactly as it is: a new key stays the only key", async () => {
  const who = home.teacher;
  const issued = await api("admin-reissue-key", { key: admin.key, body: { handle: who.handle } });
  assert.equal(issued.status, 200, issued.text);
  const C = await space("Cee", "cee-hive");
  assert.equal((await api("admin-add-member", { key: admin.key, body: { handle: who.handle, org: C } })).status, 200);
  assert.equal((await api("admin-suspend-app", { key: admin.key, body: { handle: who.handle } })).status, 200);
  const before = await text(`user:${who.handle}`);

  const done = await restore(fileB);
  assert.equal(await text(`user:${who.handle}`), before, "the account is untouched");
  assert.equal(done.why(`user:${who.handle}`), "kept");
  assert.equal(await raw(`key:${sha(who.key)}`), null, "the replaced key does not come back");
  assert.equal(done.why(`key:${sha(who.key)}`), "key-changed");
  assert.equal(await raw(`key:${sha(issued.json.key)}`), who.handle, "the new key still works");
  /* Their practice, from the file, folded into the document under the new key. */
  const now = await sync(sha(issued.json.key));
  assert.ok(now.json.data.items.some((/** @type {any} */ i) => i.id === "p1"));
  home.teacher.key = issued.json.key;
  assert.equal((await api("admin-lift-app", { key: admin.key, body: { handle: who.handle } })).status, 200);
});

/* ------------------------------------------------------ 5 (A6). practice since */

test("practice done since the file is kept beside the file's, and a third restore writes nothing", async () => {
  const token = sha(home.teacher.key);
  const now = await sync(token);
  const items = now.json.data.items.concat([{ id: "p2", updated: 2 }]);
  assert.equal((await sync(token, { method: "POST", body: { data: { ...now.json.data, items }, etag: now.json.etag } })).status, 200);
  await restore(fileB);
  const both = (await sync(token)).json;
  assert.deepEqual(both.data.items.map((/** @type {any} */ i) => i.id).sort(), ["p1", "p2"]);
  const again = await restore(fileB);
  assert.equal(again.why(`progress:${home.teacher.handle}`), "exists");
  assert.equal((await sync(token)).json.etag, both.etag, "the document is not written again");
});

/* ---------------------------------------------------------- 2. not a member */

test("someone taken out of the space since is not put back into it", async () => {
  const who = roomB.other;
  /* Their own card in B, so there is material of theirs to come back. */
  assert.equal((await api("admin-remove-member", { key: admin.key, org: B, body: { handle: who.handle } })).status, 200);
  const seen = await preview(fileB);
  assert.ok(handlesIn(seen.people.notMember).includes(who.handle), "the preview names them");
  assert.deepEqual(seen.blockers, []);
  const before = await text(`user:${who.handle}`);
  const done = await restore(fileB);
  assert.equal(done.why(`user:${who.handle}`), "not-member");
  assert.equal(await text(`user:${who.handle}`), before);
  const course = await raw(`course:${roomB.course.id}`);
  assert.ok(!course.students.includes(who.handle), "and an existing course's roster is not touched");
});

/* -------------------------------------------- 3, 10, 13. deleted, bring back */

test("an account deleted since stays deleted; ticked, it comes back with its old key", async () => {
  const who = roomB.student;
  const token = sha(who.key);
  assert.equal((await sync(token, { method: "POST", body: { data: { items: [{ id: "s1", updated: 1 }] } } })).status, 200);
  const file = await takeBackup(B);
  assert.equal((await api("admin-delete-user", { key: admin.key, org: B, body: { handle: who.handle } })).status, 200);
  assert.ok(await raw(`gone:${who.handle}`));

  const seen = await preview(file);
  assert.deepEqual(handlesIn(seen.people.deleted), [who.handle]);
  const done = await restore(file);
  assert.equal(await raw(`user:${who.handle}`), null, "no account");
  assert.ok(!(await raw("index:users")).includes(who.handle), "and People does not list them (10)");
  /* The preview's lists are what the restore did (13). */
  for (const p of seen.people.deleted) assert.equal(done.why(`user:${p.handle}`), "deleted");
  for (const p of seen.people.kept) assert.equal(done.why(`user:${p.handle}`), "kept");
  for (const p of seen.people.notMember) assert.equal(done.why(`user:${p.handle}`), "not-member");
  assert.equal(done.why(`progress:${who.handle}`), "no-account");

  const ticked = await preview(file, { bringBack: [who.handle] });
  assert.deepEqual(handlesIn(ticked.people.recreate), [who.handle]);
  await restore(file, { bringBack: [who.handle] });
  const back = await raw(`user:${who.handle}`);
  assert.deepEqual(back.orgs, [B], "back in this space only");
  assert.equal(await raw(`gone:${who.handle}`), null);
  assert.ok(!(await raw("index:gone")).includes(who.handle));
  assert.ok(!((await raw(`former:${B}`)) || []).some((/** @type {any} */ r) => r.handle === who.handle));
  assert.ok((await raw("index:users")).includes(who.handle));
  assert.equal((await api("whoami", { key: who.key })).status, 200, "their old key signs in");
  assert.equal((await sync(token)).json.data.items[0].id, "s1", "with their practice");
});

/* ------------------------------------------------------------- 6. rosters */

test("a restored course leaves off who is not in the space; an existing one is untouched", async () => {
  const gone = roomB.course.id;
  const before = await raw(`course:${gone}`);
  await store.delete(`course:${gone}`);
  const seen = await preview(fileB);
  const trimmed = seen.rosters.find((/** @type {any} */ r) => r.course === gone);
  assert.ok(trimmed && trimmed.dropped.includes(roomB.other.handle), "the preview names whose name comes off");
  await restore(fileB);
  const back = await raw(`course:${gone}`);
  assert.ok(!back.students.includes(roomB.other.handle), "removed since: not on the restored roster");
  assert.ok(back.students.includes(roomB.student.handle), "a member stays");
  assert.equal((await raw(`code:${back.code}`)), gone, "its code opens it again");
  assert.deepEqual(before.decks, back.decks);
});

/* ------------------------------------------------------------- 7. material */

test("a card edited since keeps its edit; a deck gets back the card it lost", async () => {
  const edited = { ...(await raw(`card:${roomB.card.id}`)), forms: [{ ar: "edited", en: "edited", lat: "edited" }] };
  await store.set(`card:${roomB.card.id}`, JSON.stringify(edited));
  const deck = await raw(`deck:${roomB.deck.id}`);
  await store.set(`deck:${roomB.deck.id}`, JSON.stringify({ ...deck, cardIds: deck.cardIds.filter((/** @type {string} */ x) => x !== roomB.card2.id) }));
  await store.delete(`card:${roomB.card2.id}`);
  const later = (await api("create-deck", { key: roomB.teacher.key, org: B, body: { title: "Made after", lang: "ar-PS" } })).json.deck;

  const done = await restore(fileB);
  assert.equal((await raw(`card:${roomB.card.id}`)).forms[0].ar, "edited", "the edit stands");
  assert.equal(done.why(`card:${roomB.card.id}`), "exists");
  assert.ok(await raw(`card:${roomB.card2.id}`), "the deleted card is back");
  const after = await raw(`deck:${roomB.deck.id}`);
  assert.ok(after.cardIds.includes(roomB.card2.id), "and in its deck again");
  assert.ok(after.version > deck.version, "which moved, so devices fetch it");
  assert.ok(await raw(`deck:${later.id}`), "a deck made after the file is still there");
});

/* ---------------------------------------------------- 8. former and systems */

test("a Former members entry and a number system made since survive", async () => {
  const former = (await raw(`former:${B}`)) || [];
  const extra = { handle: "someone-later", displayName: "Later", joined: 1, left: 2, courses: [], why: "removed", by: admin.handle };
  await store.set(`former:${B}`, JSON.stringify(former.concat([extra])));
  const t = roomB.teacher.handle;
  await store.set(`mysystems:${t}`, JSON.stringify({ numbers: { "he-IL": "made-later" }, times: {} }));
  const file = structuredClone(fileB);
  file.records[`mysystems:${t}`] = { numbers: { "ar-PS": "from-file" }, times: {} };
  await restore(file);
  assert.ok((await raw(`former:${B}`)).some((/** @type {any} */ r) => r.handle === "someone-later"));
  assert.deepEqual((await raw(`mysystems:${t}`)).numbers, { "he-IL": "made-later", "ar-PS": "from-file" });
});

/* ----------------------------------------------------------- 9. space card */

test("a space keeps its own card unless asked; asked, it takes the file's name, not its address", async () => {
  assert.equal((await api("admin-update-org", { key: admin.key, body: { id: B, name: "Renamed" } })).status, 200);
  await restore(fileB);
  assert.equal((await raw(`org:${B}`)).name, "Renamed");
  const done = await restore(fileB, { keepSpaceCard: false });
  const org = await raw(`org:${B}`);
  assert.equal(org.name, "Bee");
  assert.equal(org.slug, "bee-hive");
  assert.equal(done.why(`org:${B}`), undefined, "folded in, not skipped");
});

/* ------------------------------------------- 4, 5. a deleted space comes back */

const D = await space("Dee", "dee-hive");
const roomD = await classroom("d", D);
const dTeacherMine = (await api("create-deck", { key: roomD.teacher.key, org: D, body: { title: "D mine", lang: "ar-PS", personal: true } })).json.deck;
assert.equal((await sync(sha(roomD.student.key), { method: "POST", body: { data: { items: [{ id: "d1", updated: 1 }] } } })).status, 200);
const fileD = await takeBackup(D);

test("a space deleted whole comes back with its people, their keys, My space and practice", async () => {
  const del = await api("admin-delete-org", { key: admin.key, body: { id: D, confirm: "Dee" } });
  assert.equal(del.status, 200, del.text);
  assert.equal(await raw(`user:${roomD.student.handle}`), null);
  const seen = await preview(fileD);
  assert.deepEqual(seen.people.otherPerson, []);
  assert.ok(handlesIn(seen.people.recreate).includes(roomD.student.handle));
  await restore(fileD);
  assert.ok(await raw(`org:${D}`));
  assert.equal(await raw("slug:dee-hive"), D);
  for (const p of [roomD.teacher, roomD.student]) {
    assert.deepEqual((await raw(`user:${p.handle}`)).orgs, [D]);
    assert.equal((await api("whoami", { key: p.key })).status, 200);
  }
  assert.ok(await raw(`deck:${dTeacherMine.id}`), "My space is back");
  assert.ok((await raw("index:decks")).includes(dTeacherMine.id));
  assert.equal((await sync(sha(roomD.student.key))).json.data.items[0].id, "d1", "and practice");
  assert.ok((await raw(`course:${roomD.course.id}`)).students.includes(roomD.student.handle));
});

test("a handle that now belongs to someone else stops the restore", async () => {
  const del = await api("admin-delete-org", { key: admin.key, body: { id: D, confirm: "Dee" } });
  assert.equal(del.status, 200, del.text);
  /* Someone new, given the old handle (possible only now its deletion
     record has gone with the space). */
  const name = roomD.teacher.handle;
  const newcomer = await api("admin-create-user", { key: admin.key, body: { displayName: "Newcomer", courseId: home.course.id, roles: ["student"] } });
  assert.equal(newcomer.status, 200, newcomer.text);
  const theirs = await raw(`user:${newcomer.json.user.handle}`);
  await store.delete(`user:${newcomer.json.user.handle}`);
  await store.set(`user:${name}`, JSON.stringify({ ...theirs, handle: name, created: 42 }));
  await store.set(`key:${theirs.keyHash}`, JSON.stringify(name));
  const seen = await preview(fileD);
  assert.deepEqual(handlesIn(seen.people.otherPerson), [name]);
  assert.ok(seen.blockers.length >= 1, "the preview will not go on");
  const done = await restore(fileD);
  assert.equal(done.why(`user:${name}`), "other-person");
  assert.equal(done.why(`mycards:${name}`), "other-person");
  assert.equal(await raw(`mycards:${name}`), null, "nothing of the file's is listed as theirs");
  assert.equal((await raw(`user:${name}`)).created, 42);
});

/* -------------------------------------------------- 9b. an address now taken */

test("a deleted space whose address is taken waits for a new one", async () => {
  const E = await space("Eee", "eee-hive");
  await classroom("e", E);
  const fileE = await takeBackup(E);
  assert.equal((await api("admin-delete-org", { key: admin.key, body: { id: E, confirm: "Eee" } })).status, 200);
  await space("Squatter", "eee-hive");
  const seen = await preview(fileE);
  assert.ok(seen.spaces[0].slugTaken);
  assert.ok(seen.blockers.length >= 1);
  const refused = await restore(fileE);
  assert.equal(refused.why(`org:${E}`), "slug-taken");
  assert.equal(await raw(`org:${E}`), null);
  assert.deepEqual((await preview(fileE, { newSlug: "eee-again" })).blockers, []);
  await restore(fileE, { newSlug: "eee-again" });
  assert.equal((await raw(`org:${E}`)).slug, "eee-again");
  assert.equal(await raw("slug:eee-again"), E);
  assert.notEqual(await raw("slug:eee-hive"), E, "the old address stays the other space's");
});

/* --------------------------------------------------------- 11. nothing silent */

test("a record the restore cannot take comes back with why", async () => {
  const done = await api("admin-restore-chunk", {
    key: admin.key,
    body: { records: { "weird:1": { a: 1 }, "card:huge": "x".repeat(5 * 1024 * 1024) }, options: { scope: { kind: "site" } } },
  });
  assert.equal(done.status, 200, done.text);
  const why = Object.fromEntries(done.json.skipped.map((/** @type {any} */ s) => [s.key, s.why]));
  assert.equal(why["weird:1"], "not-allowed");
  assert.equal(why["card:huge"], "too-large");
  assert.equal(done.json.written + done.json.merged + done.json.skipped.length, 2);
});

/* ---------------------------------------------------- 12. twice is a no-op */

/** Every file in the data directory, with its contents' digest. */
async function snapshot() {
  /** @type {Record<string, string>} */
  const out = {};
  const walk = async (/** @type {string} */ d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else out[path.relative(dir, p)] = sha(await readFile(p, "utf8"));
    }
  };
  await walk(dir);
  return out;
}

test("restoring a site's file into a site that has it all changes nothing at all", async () => {
  const file = await takeBackup();
  const before = await snapshot();
  const done = await restore(file);
  const all = Object.keys(file.records).concat(Object.keys(file.manifest.indexes).map((w) => `index:${w}`));
  assert.deepEqual(all.filter((k) => !done.skipped.some((s) => s.key === k)), [], "every record is left alone");
  assert.equal(done.written, 0);
  assert.equal(done.merged, 0);
  assert.equal(done.written + done.merged + done.skipped.length, done.sent);
  assert.deepEqual(await snapshot(), before);
});

/* -------------------------------------- A6.9: clear everything, then restore */

test("a course's path and its units survive a backup and restore (0.611)", async () => {
  const unit = await api("create-unit", { key: roomB.teacher.key, org: B, body: { courseId: roomB.course.id, title: "Unit B" } });
  assert.equal(unit.status, 200, unit.text);
  const unitId = unit.json.deck.id;
  /* Published and opened early as a teacher would leave it; written
     straight to the course, since publishing needs a checklist this room's
     cards do not clear. */
  const courseKey = `course:${roomB.course.id}`;
  const had = await raw(courseKey);
  await store.set(courseKey, JSON.stringify({ ...had, pathLive: { [unitId]: 5 }, opened: [unitId] }));
  const file = await takeBackup();
  const cleared = await api("admin-clear", { key: admin.key, body: { adminKey: ADMIN_KEY, parts: ["courses", "decks"] } });
  assert.equal(cleared.status, 200, cleared.text);
  assert.equal(await raw(courseKey), null);
  await restore(file);
  const back = await raw(courseKey);
  assert.deepEqual(back.path, [unitId]);
  assert.deepEqual(back.pathLive, { [unitId]: 5 });
  assert.deepEqual(back.opened, [unitId]);
  assert.equal((await raw(`deck:${unitId}`)).unit, true);
});

test("a whole site cleared and restored has everyone, everything and all practice back", async () => {
  const file = await takeBackup();
  const parts = ["spaces", "people", "courses", "decks", "cards", "flags", "clips", "progress"];
  const cleared = await api("admin-clear", { key: admin.key, body: { adminKey: ADMIN_KEY, parts } });
  assert.equal(cleared.status, 200, cleared.text);
  assert.ok(cleared.json.removed.progress >= 1, "practice is cleared with its part");
  assert.equal((await sync(sha(roomB.student.key))).json.data, null);
  await restore(file);
  assert.equal((await api("whoami", { key: roomB.student.key })).status, 200);
  assert.equal((await sync(sha(roomB.student.key))).json.data.items[0].id, "s1");
  assert.ok(await raw(`card:${roomB.card2.id}`));
  assert.equal((await api("whoami", { key: admin.key })).status, 200, "the acting admin's key still works");
  /* And again: nothing more to add. */
  const again = await restore(file);
  assert.equal(again.written, 0);
});

/* ------------------------------------------------------------------ 15. */

test("only the App admin may preview a restore", async () => {
  const lead = await api("admin-create-org", { key: admin.key, body: { name: "Gee", slug: "gee-hive", adminName: "Gee lead" } });
  const r = await api("admin-restore-preview", { key: lead.json.key, org: lead.json.org.id, body: { options: {}, users: [] } });
  assert.equal(r.status, 403);
});
