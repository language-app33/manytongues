/*
 * Spaces (orgs in code): nothing in one can be seen or touched from another.
 *
 * Two spaces are built through the real API — Main, where everything that
 * existed before spaces lives, and B, made with admin-create-org — each
 * with a teacher, a student, a course, a deck and a card. Then every action
 * that names a course, deck, card, person or report is tried from one space
 * against the other, and every list is checked for the other space's
 * records. The last test fails when a new action is added to the server
 * without being placed in this file's table, so a later action cannot
 * arrive without its check. See docs/PLAN-spaces.md, B3 and B7.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

const dir = await mkdtemp(path.join(tmpdir(), "manytongues-spaces-"));
process.env.DATA_DIR = dir;
process.env.ADMIN_KEY = "spaces-admin";
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

const card = (/** @type {string} */ word) => ({
  id: "",
  lang: "ar-PS",
  forms: [{ ar: word, en: word, lat: word }],
});

/* ---------------------------------------------------------------- setup */

const admin = await signup("Owner");
assert.equal((await api("claim-admin", { key: admin.key, body: { adminKey: "spaces-admin" } })).status, 200);

/** Build a space's people and material, acting as the App admin in it. */
async function furnish(/** @type {string | undefined} */ org, /** @type {string} */ tag) {
  const course = (await api("create-course", { key: admin.key, org, body: { title: `Course ${tag}`, language: "ar-PS" } })).json.course;
  const teacher = (await api("admin-create-user", {
    key: admin.key, org, body: { displayName: `Teacher ${tag}`, courseId: course.id, roles: ["teacher"] },
  })).json;
  const student = (await api("admin-create-user", {
    key: admin.key, org, body: { displayName: `Student ${tag}`, courseId: course.id, roles: ["student"] },
  })).json;
  const t = { key: teacher.key, handle: teacher.user.handle };
  const s = { key: student.key, handle: student.user.handle };
  const deck = (await api("create-deck", { key: t.key, body: { title: `Deck ${tag}`, description: "", lang: "ar-PS" } })).json.deck;
  assert.equal((await api("attach-deck", { key: t.key, body: { deckId: deck.id, courseId: course.id } })).status, 200);
  const saved = await api("save-card", { key: t.key, body: { card: card(`word-${tag}`), decks: [deck.id] } });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  const flag = await api("report-flag", {
    key: s.key, body: { kind: "other", note: "x", cardId: saved.json.card.id, deckId: deck.id, courseId: course.id },
  });
  return { course, teacher: t, student: s, deck, card: saved.json.card, flagId: flag.json.id };
}

const made = await api("admin-create-org", {
  key: admin.key, body: { name: "Lingua", slug: "lingua", adminName: "Rana" },
});
assert.equal(made.status, 200, JSON.stringify(made.json));
const B = made.json.org.id;
const bAdmin = { key: made.json.key, handle: made.json.admin.handle };

const main = await furnish(undefined, "main");
const b = await furnish(B, "b");

/* --------------------------------------------------------------- tests */

test("Main exists, and a space is made with its first admin", async () => {
  const store = getStore("arabic-courses");
  const mainOrg = JSON.parse(String(await store.get("org:main", { type: "text" })));
  assert.equal(mainOrg.slug, "main");
  assert.equal(mainOrg.name, "Main");
  assert.equal(made.json.org.slug, "lingua");
  assert.deepEqual(made.json.org.admins, [bAdmin.handle]);
  /* The address is taken for good, and a reserved or malformed one refused. */
  assert.equal((await api("admin-create-org", { key: admin.key, body: { name: "X", slug: "lingua", adminName: "Y" } })).status, 409);
  for (const bad of ["main", "api", "ab", "a--b", "1abc", "my space"]) {
    const r = await api("admin-create-org", { key: admin.key, body: { name: "X", slug: bad, adminName: "Y" } });
    assert.equal(r.status, 400, bad);
  }
  /* Only an App admin may make one. */
  assert.equal((await api("admin-create-org", { key: bAdmin.key, body: { name: "X", slug: "xyz", adminName: "Y" } })).status, 403);
});

test("records made in a space carry it; older ones read as Main", async () => {
  const store = getStore("arabic-courses");
  const read = async (/** @type {string} */ k) => JSON.parse(String(await store.get(k, { type: "text" })));
  assert.equal((await read(`course:${b.course.id}`)).org, B);
  assert.equal((await read(`deck:${b.deck.id}`)).org, B);
  assert.equal((await read(`card:${b.card.id}`)).org, B);
  assert.equal((await read(`user:${b.teacher.handle}`)).org, B);
  assert.equal((await read(`flag:${b.flagId}`)).org, B);
  /* A record written before spaces has no org at all, and is Main's. */
  await store.set("course:legacy", JSON.stringify({
    id: "legacy", title: "Old course", language: "ar-PS", teachers: [], students: [], decks: [],
  }));
  await store.set("index:courses", JSON.stringify(
    JSON.parse(String(await store.get("index:courses", { type: "text" }))).concat(["legacy"])
  ));
  const inMain = (await api("admin-overview", { key: admin.key })).json.courses.map((/** @type {any} */ c) => c.id);
  assert.ok(inMain.includes("legacy"));
  const inB = (await api("admin-overview", { key: admin.key, org: B })).json.courses.map((/** @type {any} */ c) => c.id);
  assert.ok(!inB.includes("legacy"));
});

/** Each probe: [action, a request from Main's teacher aimed at B's records]. */
const crossing = () => /** @type {[string, any][]} */ ([
  ["course-decks", { params: { course: b.course.id } }],
  ["deck-cards", { params: { deck: b.deck.id } }],
  ["number-sources", { params: { deck: b.deck.id } }],
  ["rename-deck", { body: { deckId: b.deck.id, title: "Mine now" } }],
  ["lock-deck", { body: { deckId: b.deck.id, locked: true } }],
  ["set-deck-parts", { body: { deckId: b.deck.id, parts: ["numbers:0-10"] } }],
  ["set-deck-numbers", { body: { deckId: b.deck.id, from: main.teacher.handle } }],
  ["delete-deck", { body: { deckId: b.deck.id } }],
  ["attach-deck", { body: { deckId: b.deck.id, courseId: main.course.id } }],
  ["detach-deck", { body: { deckId: b.deck.id, courseId: b.course.id } }],
  ["save-card", { body: { card: { ...b.card, forms: [{ ar: "x", en: "x", lat: "x" }] }, decks: [] } }],
  ["card-status", { body: { cardId: b.card.id, to: "draft" } }],
  ["review-card", { body: { cardId: b.card.id, ok: [] } }],
  ["delete-card", { body: { cardId: b.card.id } }],
  ["join-course", { body: { code: "" } }],
]);

test("a teacher in Main can't reach anything of B's", async () => {
  const course = (await api("my-courses", { key: b.teacher.key })).json.courses.find((/** @type {any} */ c) => c.id === b.course.id);
  for (const [action, req] of crossing()) {
    const r = /** @type {any} */ (req);
    if (action === "join-course") r.body = { code: course.code };
    const res = await api(action, { key: main.teacher.key, ...r });
    assert.ok(res.status >= 400, `${action} answered ${res.status}: ${JSON.stringify(res.json)}`);
  }
  /* And B's deck and card are untouched. */
  const store = getStore("arabic-courses");
  const deck = JSON.parse(String(await store.get(`deck:${b.deck.id}`, { type: "text" })));
  assert.equal(deck.title, "Deck b");
  assert.ok(await store.get(`card:${b.card.id}`, { type: "text" }));
});

test("a space admin is just a member elsewhere, and an App admin only acts where asked", async () => {
  /* B's admin can't reach Main's deck. */
  assert.ok((await api("deck-cards", { key: bAdmin.key, params: { deck: main.deck.id } })).status >= 400);
  /* The App admin, in Main by default, doesn't see B's deck... */
  assert.ok((await api("deck-cards", { key: admin.key, params: { deck: b.deck.id } })).status >= 400);
  /* ...until acting in B. */
  assert.equal((await api("deck-cards", { key: admin.key, org: B, params: { deck: b.deck.id } })).status, 200);
  /* A made-up org falls back to the admin's own. */
  assert.ok((await api("deck-cards", { key: admin.key, org: "onope", params: { deck: b.deck.id } })).status >= 400);
  /* x-org means nothing from anyone else. */
  assert.ok((await api("deck-cards", { key: main.teacher.key, org: B, params: { deck: b.deck.id } })).status >= 400);
});

test("every list leaves the other space out", async () => {
  const ids = (/** @type {any[]} */ rows) => (rows || []).map((r) => r.id || r.handle);
  const mine = await api("my-courses", { key: main.teacher.key });
  assert.ok(!ids(mine.json.courses).includes(b.course.id));
  const decks = await api("my-decks", { key: main.teacher.key });
  assert.ok(!ids(decks.json.decks).includes(b.deck.id));
  const cards = await api("my-cards", { key: main.teacher.key });
  assert.ok(!ids(cards.json.cards).includes(b.card.id));
  const material = await api("my-material", { key: main.student.key });
  assert.ok(!ids(material.json.decks).includes(b.deck.id));
  assert.ok(!ids(material.json.cards).includes(b.card.id));

  const overview = (await api("admin-overview", { key: admin.key })).json;
  assert.ok(!ids(overview.courses).includes(b.course.id));
  assert.ok(!ids(overview.decks).includes(b.deck.id));
  assert.ok(!ids(overview.users).includes(b.teacher.handle));
  assert.ok(!ids(overview.flags).includes(b.flagId));
  assert.ok(ids(overview.courses).includes(main.course.id));

  const inB = (await api("admin-overview", { key: admin.key, org: B })).json;
  assert.ok(ids(inB.courses).includes(b.course.id));
  assert.ok(!ids(inB.courses).includes(main.course.id));
  assert.ok(ids(inB.users).includes(b.teacher.handle));

  const reports = (await api("my-reports", { key: admin.key })).json.flags;
  assert.ok(!ids(reports).includes(b.flagId));
  assert.ok(ids(reports).includes(main.flagId));
  const reportsB = (await api("my-reports", { key: admin.key, org: B })).json.flags;
  assert.ok(ids(reportsB).includes(b.flagId));
});

test("admin actions refuse another space's people, courses and reports", async () => {
  const probes = [
    ["admin-reissue-key", { handle: b.teacher.handle }],
    ["admin-delete-user", { handle: b.student.handle }],
    ["admin-delete-course", { courseId: b.course.id }],
    ["admin-rename-course", { courseId: b.course.id, title: "x" }],
    ["admin-course-language", { courseId: b.course.id, language: "vi-VN" }],
    ["admin-new-code", { courseId: b.course.id, which: "student" }],
    ["assign-student", { courseId: b.course.id, handle: main.student.handle }],
    ["assign-teacher", { courseId: main.course.id, handle: b.teacher.handle }],
    ["remove-member", { courseId: b.course.id, handle: b.student.handle, role: "student" }],
  ];
  for (const [action, body] of probes) {
    const res = await api(/** @type {string} */ (action), { key: admin.key, body });
    assert.ok(res.status >= 400, `${action} answered ${res.status}`);
  }
  const card = await api("admin-card", { key: admin.key, params: { card: b.card.id } });
  assert.ok(card.status >= 400, `admin-card answered ${card.status}`);
  await api("admin-delete-flags", { key: admin.key, body: { flagIds: [b.flagId] } });
  await api("dismiss-reports", { key: admin.key, body: { flagIds: [b.flagId] } });
  const reportsB = (await api("my-reports", { key: admin.key, org: B })).json.flags;
  assert.ok(reportsB.some((/** @type {any} */ f) => f.id === b.flagId), "B's report survives Main's deletes");
});

test("export takes nothing from another space", async () => {
  const plan = await api("export-plan", { key: admin.key, body: { deckIds: [b.deck.id], cardIds: [b.card.id], media: false } });
  const keys = JSON.stringify(plan.json);
  assert.ok(!keys.includes(b.card.id), keys);
});

/*
 * Every action, placed. `crossed` are tried above; `own` act only on the
 * caller's own account, systems or content-addressed media; `site` are the
 * App admin's whole-site tools. A new action must be added to one of them.
 */
const PLACED = {
  crossed: [
    "course-decks", "deck-cards", "number-sources", "rename-deck", "lock-deck", "set-deck-parts",
    "set-deck-numbers", "delete-deck", "attach-deck", "detach-deck", "save-card", "card-status",
    "review-card", "delete-card", "delete-cards", "join-course", "my-courses", "my-decks", "my-cards",
    "my-material", "my-reports", "dismiss-reports", "admin-overview", "admin-reissue-key",
    "admin-delete-user", "admin-delete-course", "admin-rename-course", "admin-course-language",
    "admin-new-code", "admin-card", "admin-delete-flags", "assign-student", "assign-teacher",
    "remove-member", "export-plan", "export-chunk", "create-course", "create-deck", "report-flag",
    "admin-create-user", "admin-create-org",
  ],
  /* The App admin's tools for spaces themselves (stage 3), tried below. */
  spaces: [
    "org-info", "admin-orgs", "admin-update-org", "admin-org-admins", "admin-archive-org",
    "admin-reopen-org", "admin-delete-org",
  ],
  own: [
    "signup", "signin", "whoami", "practiced", "delete-account", "rename", "claim-admin",
    "my-systems", "save-system", "sign-system", "delete-system",
    "clip", "image", "put-clip", "put-image", "media-sizes",
  ],
  site: ["admin-backup-manifest", "admin-backup-chunk", "admin-restore-chunk", "admin-clear"],
};

test("every action on the server is placed in this file", async () => {
  const src = await readFile(new URL("../server/api/courses.js", import.meta.url), "utf8");
  const actions = [...new Set([...src.matchAll(/action === "([a-z-]+)"/g)].map((m) => m[1]))];
  const placed = new Set(Object.values(PLACED).flat());
  const missing = actions.filter((a) => !placed.has(a));
  assert.deepEqual(missing, [], `place these in tests/spaces.test.mjs: ${missing.join(", ")}`);
});

/* ------------------------------------------------------- stage 3 (0.543) */

test("a space's address shows its face, and an old address forwards", async () => {
  const info = await api("org-info", { params: { slug: "lingua" } });
  assert.equal(info.status, 200);
  assert.equal(info.json.org.name, "Lingua");
  assert.equal(info.json.org.closed, false);
  assert.equal(JSON.stringify(info.json).includes(b.teacher.handle), false, "never its people");
  assert.equal((await api("org-info", { params: { slug: "nowhere" } })).status, 404);

  const moved = await api("admin-update-org", { key: admin.key, body: { id: B, slug: "lingua-school", colour: "#123456" } });
  assert.equal(moved.status, 200, JSON.stringify(moved.json));
  assert.equal((await api("org-info", { params: { slug: "lingua" } })).json.moved, "lingua-school");
  assert.equal((await api("org-info", { params: { slug: "lingua-school" } })).json.org.colour, "#123456");
  /* The old address stays B's for ever. */
  const reuse = await api("admin-create-org", { key: admin.key, body: { name: "Other", slug: "lingua", adminName: "X" } });
  assert.equal(reuse.status, 409);
  /* Only an App admin changes a space. */
  assert.equal((await api("admin-update-org", { key: bAdmin.key, body: { id: B, name: "Mine" } })).status, 403);
});

test("signing up needs a code, and the code decides the space", async () => {
  assert.equal((await api("signup", { body: { displayName: "Nobody" } })).status, 403);
  assert.equal((await api("signup", { body: { displayName: "Nobody", code: "no-such-code" } })).status, 403);
  const orgs = (await api("admin-orgs", { key: admin.key })).json.orgs;
  const inviteB = orgs.find((/** @type {any} */ o) => o.id === B).inviteCode;
  const joined = await api("signup", { body: { displayName: "Newcomer", code: inviteB } });
  assert.equal(joined.status, 200);
  assert.equal(joined.json.user.org.id, B);
  /* At Main's address, B's code is stopped, and says whose it is. */
  const wrong = await api("signup", { body: { displayName: "Lost", code: inviteB, org: "main" } });
  assert.equal(wrong.status, 409);
  assert.equal(wrong.json.space.id, B);
  /* A course code puts them on the course. */
  const course = (await api("my-courses", { key: b.teacher.key })).json.courses.find((/** @type {any} */ c) => c.id === b.course.id);
  const pupil = await api("signup", { body: { displayName: "Pupil", code: course.code } });
  assert.equal(pupil.status, 200);
  const roster = (await api("admin-overview", { key: admin.key, org: B })).json.courses.find((/** @type {any} */ c) => c.id === b.course.id);
  assert.ok(roster.students.includes(pupil.json.user.handle));
});

test("signing in at another space's address says whose the key is", async () => {
  const wrong = await api("whoami", { key: b.student.key, params: { org: "main" } });
  assert.equal(wrong.status, 409);
  assert.equal(wrong.json.space.id, B);
  const right = await api("whoami", { key: b.student.key, params: { org: B } });
  assert.equal(right.status, 200);
  assert.equal(right.json.user.org.id, B);
  /* An App admin may open any address. */
  assert.equal((await api("whoami", { key: admin.key, params: { org: B } })).status, 200);
  /* A course code from another space, used by someone signed in, says whose. */
  const course = (await api("my-courses", { key: b.teacher.key })).json.courses.find((/** @type {any} */ c) => c.id === b.course.id);
  const join = await api("join-course", { key: main.student.key, body: { code: course.code } });
  assert.equal(join.status, 409);
  assert.equal(join.json.space.id, B);
});

test("a closed space refuses its people until it reopens", async () => {
  assert.equal((await api("admin-archive-org", { key: admin.key, body: { id: B } })).status, 200);
  assert.equal((await api("whoami", { key: b.student.key })).json.error, "space-closed");
  assert.equal((await api("my-material", { key: b.student.key })).status, 403);
  assert.equal((await api("org-info", { params: { slug: "lingua-school" } })).json.org.closed, true);
  assert.equal((await api("admin-archive-org", { key: admin.key, body: { id: "main" } })).status, 400);
  assert.equal((await api("admin-reopen-org", { key: admin.key, body: { id: B } })).status, 200);
  assert.equal((await api("whoami", { key: b.student.key })).status, 200);
});

test("deleting a space takes everything in it, frees its addresses, and leaves Main alone", async () => {
  const made = await api("admin-create-org", { key: admin.key, body: { name: "Test", slug: "test-space", adminName: "T" } });
  const T = made.json.org.id;
  const t = await furnish(T, "t");
  /* The student has practice history on the server. */
  const token = createHash("sha256").update(t.student.key).digest("hex");
  await fetch(`${origin}/api/sync`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sync-token": token },
    body: JSON.stringify({ data: { items: [] } }),
  });
  const before = await fetch(`${origin}/api/sync`, { headers: { "x-sync-token": token } }).then((r) => r.json());
  assert.ok(before.data, "the practice document exists first");

  assert.equal((await api("admin-delete-org", { key: admin.key, body: { id: T, confirm: "wrong" } })).status, 400);
  assert.equal((await api("admin-delete-org", { key: admin.key, body: { id: T, confirm: "Test" } })).status, 200);

  const store = getStore("arabic-courses");
  for (const k of [`org:${T}`, `course:${t.course.id}`, `deck:${t.deck.id}`, `card:${t.card.id}`, `user:${t.student.handle}`, `flag:${t.flagId}`]) {
    assert.equal(await store.get(k, { type: "text" }), null, k);
  }
  const after = await fetch(`${origin}/api/sync`, { headers: { "x-sync-token": token } }).then((r) => r.json());
  assert.equal(after.data, null, "the practice history is gone");
  assert.equal((await api("org-info", { params: { slug: "test-space" } })).status, 404);
  /* Main and B are untouched. */
  assert.ok(await store.get(`deck:${main.deck.id}`, { type: "text" }));
  assert.ok(await store.get(`card:${b.card.id}`, { type: "text" }));
  assert.equal((await api("admin-delete-org", { key: admin.key, body: { id: "main", confirm: "Main" } })).status, 400);
});
