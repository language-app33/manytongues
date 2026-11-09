/*
 * The server's half of the 6 November 2026 audit of 0.579
 * (docs/AUDIT-stability-0.579.md): every finding that lost data on the
 * server, tried against the real API on a scratch store. Each test here
 * failed on 0.579.
 *
 * Its own file, and so its own data directory and its own process: the
 * tests below clear and restore the site, which no other file's tests could
 * share a store with.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

const dir = await mkdtemp(path.join(tmpdir(), "manytongues-audit-"));
process.env.DATA_DIR = dir;
const ADMIN_KEY = "audit-admin";
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
 * @param {{ key?: string, body?: unknown, params?: Record<string, string>, org?: string, headers?: Record<string, string> }} [o]
 */
async function api(action, { key, body, params, org, headers: extra } = {}) {
  const url = new URL(`${origin}/api/courses`);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const headers = /** @type {Record<string, string>} */ ({ "content-type": "application/json", ...(extra || {}) });
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
  return { status: res.status, json, text, headers: res.headers };
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

/* ---------------------------------------------------------------- setup */

const first = await api("signup", { body: { displayName: "Owner" } });
const admin = { key: first.json.key, handle: first.json.user.handle };
assert.equal((await api("claim-admin", { key: admin.key, body: { adminKey: ADMIN_KEY } })).status, 200);

/** A course in a space, with a teacher and a student made by the App admin. */
/**
 * @param {string} tag
 * @param {string} [org]
 */
async function classroom(tag, org) {
  const course = (await api("create-course", { key: admin.key, org, body: { title: `Course ${tag}`, language: "ar-PS" } })).json.course;
  const made = async (/** @type {string} */ role) => {
    const r = await api("admin-create-user", {
      key: admin.key, org, body: { displayName: `${role} ${tag}`, courseId: course.id, roles: [role] },
    });
    assert.equal(r.status, 200, r.text);
    return { key: r.json.key, handle: r.json.user.handle };
  };
  const teacher = await made("teacher");
  const student = await made("student");
  const deck = (await api("create-deck", { key: teacher.key, body: { title: `Deck ${tag}`, lang: "ar-PS" } })).json.deck;
  assert.equal((await api("attach-deck", { key: teacher.key, body: { deckId: deck.id, courseId: course.id } })).status, 200);
  return { course, teacher, student, deck };
}

/** A saved card, asserted. */
async function save(/** @type {string} */ key, /** @type {any} */ body) {
  const r = await api("save-card", { key, body });
  assert.equal(r.status, 200, r.text);
  return r.json.card;
}

const store = getStore("arabic-courses");
const raw = async (/** @type {string} */ k) => {
  const t = await store.get(k, { type: "text" });
  return t == null ? null : JSON.parse(String(t));
};

/* ------------------------------------------------------- A1: a new key */

test("a new sign-in key carries the practice document and its recordings with it", async () => {
  const room = await classroom("a1");
  const oldToken = sha(room.student.key);
  const doc = { items: [{ id: "i1", forms: [{ ar: "بيت", recs: [{ id: "rec1" }] }] }] };
  assert.equal((await sync(oldToken, { method: "POST", body: { data: doc } })).status, 200);
  assert.equal((await sync(oldToken, { method: "POST", audio: "rec1", body: { data: "AUDIO-BYTES" } })).status, 200);

  const issued = await api("admin-reissue-key", { key: admin.key, body: { handle: room.student.handle } });
  assert.equal(issued.status, 200, issued.text);
  const newToken = sha(issued.json.key);

  const now = await sync(newToken);
  assert.equal(now.json.data.items[0].id, "i1", "the new key opens the same practice");
  const clip = await sync(newToken, { audio: "rec1" });
  assert.equal(clip.status, 200);
  assert.equal(clip.json.data, "AUDIO-BYTES", "and its recording");
  assert.equal((await sync(oldToken)).json.data, null, "the old key's copy is gone");
  assert.equal((await sync(oldToken, { audio: "rec1" })).status, 404);

  /* A second new key, with no document behind the first, is a quiet no-op
     — and carries the document again. */
  const again = await api("admin-reissue-key", { key: admin.key, body: { handle: room.student.handle } });
  assert.equal(again.status, 200);
  assert.equal((await sync(sha(again.json.key))).json.data.items[0].id, "i1");
});

test("a new key never overwrites a document already under it", async () => {
  const { moveSyncDoc } = await import("../server/api/sync.js");
  const a = sha("old-key-a1b");
  const b = sha("new-key-a1b");
  await sync(a, { method: "POST", body: { data: { items: [{ id: "from-a" }] } } });
  await sync(b, { method: "POST", body: { data: { items: [{ id: "already-b" }] } } });
  const r = await moveSyncDoc(a, b);
  assert.deepEqual(r, { moved: false, reason: "exists" });
  assert.equal((await sync(b)).json.data.items[0].id, "already-b");
  assert.equal((await sync(a)).json.data.items[0].id, "from-a", "and the old one is left where it was");
  assert.deepEqual(await moveSyncDoc("nope", b), { moved: false });
});

/* -------------------------------------------- A2: former accounts' cards */

/** Every chunk of a manifest, fetched. */
async function wholeBackup(/** @type {any} */ manifest) {
  /** @type {Record<string, any>} */
  const records = {};
  for (const c of manifest.plan) {
    const got = await api("admin-backup-chunk", { key: admin.key, body: { keys: c.keys } });
    assert.equal(got.status, 200, got.text);
    Object.assign(records, got.json.records);
  }
  return records;
}

test("a full backup keeps a deleted teacher's cards, recordings and list of cards", async () => {
  const room = await classroom("a2");
  const hash = "a".repeat(64);
  assert.equal((await api("put-clip", { key: room.teacher.key, body: { hash, data: "data:audio/webm;base64,AAAA" } })).status, 200);
  const inDeck = await save(room.teacher.key, {
    card: card("kitaab-a2", { forms: [{ ar: "كتاب", en: "book-a2", lat: "kitaab", clips: [hash] }] }),
    decks: [room.deck.id],
  });
  const value = await save(room.teacher.key, { card: card("sami-a2", { fills: ["guest"], drill: false }), decks: [] });
  for (const c of [inDeck, value]) {
    assert.equal((await api("card-status", { key: room.teacher.key, body: { cardId: c.id, to: "published" } })).status, 200);
  }

  const gone = await api("admin-delete-user", { key: admin.key, body: { handle: room.teacher.handle } });
  assert.equal(gone.status, 200, gone.text);

  const got = await api("admin-backup-manifest", { key: admin.key });
  assert.equal(got.status, 200, got.text);
  const manifest = got.json.manifest;
  const planned = manifest.plan.flatMap((/** @type {any} */ c) => c.keys);
  for (const c of [inDeck, value]) assert.ok(planned.includes(`card:${c.id}`), `card ${c.id} is in the backup`);
  assert.ok(planned.includes(`clip:${hash}`), "with its recording");
  assert.ok(planned.includes(`mycards:${room.teacher.handle}`), "and the former teacher's list of cards");

  /* Taken off the site, and put back from the file: the student is served
     both again. */
  const records = await wholeBackup(manifest);
  for (const k of [`card:${inDeck.id}`, `card:${value.id}`, `mycards:${room.teacher.handle}`]) await store.delete(k);
  await store.set(`deck:${room.deck.id}`, JSON.stringify({ ...(await raw(`deck:${room.deck.id}`)), cardIds: [] }));
  const keys = Object.keys(records);
  for (let i = 0; i < keys.length; i += 150) {
    const part = Object.fromEntries(keys.slice(i, i + 150).map((k) => [k, records[k]]));
    const put = await api("admin-restore-chunk", { key: admin.key, body: { records: part } });
    assert.equal(put.status, 200, put.text);
  }
  const served = await api("deck-cards", { key: room.student.key, params: { deck: room.deck.id } });
  assert.equal(served.status, 200, served.text);
  assert.ok(served.json.cards.some((/** @type {any} */ c) => c.id === inDeck.id), "the deck's card is back for the student");
  assert.ok(await raw(`card:${value.id}`), "and the value card is back on the site");
  assert.ok((await raw(`mycards:${room.teacher.handle}`)).includes(value.id), "on its owner's list, for a hand-over");
});

/* ------------------------------------ A3: a space keeps its second-space members */

test("a space's export keeps a member whose first space is elsewhere, with their cards", async () => {
  const made = await api("admin-create-org", { key: admin.key, body: { name: "Bee", slug: "bee-space", adminName: "Bea" } });
  assert.equal(made.status, 200, made.text);
  const B = made.json.org.id;
  const inB = await classroom("a3b", B);
  const home = await classroom("a3main");
  /* A teacher made in Main joins B with its course's teacher code. */
  const course = await raw(`course:${inB.course.id}`);
  const joined = await api("join-course", { key: home.teacher.key, org: B, body: { code: course.teacherCode } });
  assert.equal(joined.status, 200, joined.text);
  const deckB = (await api("create-deck", { key: home.teacher.key, org: B, body: { title: "Deck by a visitor", lang: "ar-PS" } })).json.deck;
  const deckCard = await api("save-card", { key: home.teacher.key, org: B, body: { card: card("visit-a3"), decks: [deckB.id] } });
  assert.equal(deckCard.status, 200, deckCard.text);
  const valueCard = await api("save-card", { key: home.teacher.key, org: B, body: { card: card("val-a3", { fills: ["guest"], drill: false }), decks: [] } });
  assert.equal(valueCard.status, 200, valueCard.text);

  const got = await api("admin-export-org-manifest", { key: admin.key, body: { id: B } });
  assert.equal(got.status, 200, got.text);
  const planned = got.json.manifest.plan.flatMap((/** @type {any} */ c) => c.keys);
  assert.ok(planned.includes(`user:${home.teacher.handle}`), "the visiting teacher is in B's export");
  assert.ok(planned.includes(`card:${deckCard.json.card.id}`), "with their deck card");
  assert.ok(planned.includes(`card:${valueCard.json.card.id}`), "and their value card");
  const usage = await api("admin-org-usage", { key: admin.key, body: { id: B } });
  assert.ok(usage.json.usage.people >= 3, "and the space's usage counts them");
});

/* --------------------------------------- A4: two saves of one card at once */

test("two saves of one card at once keep both edits", async () => {
  const room = await classroom("a4");
  const made = await save(room.teacher.key, { card: card("both-a4"), decks: [room.deck.id] });
  const held = (await api("my-cards", { key: room.teacher.key })).json.cards.find((/** @type {any} */ c) => c.id === made.id);
  const [a, b] = await Promise.all([
    api("save-card", { key: room.teacher.key, body: { card: { ...held, note: "a note" }, decks: [room.deck.id] } }),
    api("save-card", { key: room.teacher.key, body: { card: { ...held, name: "a-name" }, decks: [room.deck.id] } }),
  ]);
  assert.equal(a.status, 200, a.text);
  assert.equal(b.status, 200, b.text);
  const now = await raw(`card:${made.id}`);
  assert.equal(now.note, "a note", "the first edit landed");
  assert.equal(now.name, "a-name", "and so did the second");
  assert.equal(now.rev, (made.rev || 1) + 2, "the revision moved once per write");
});

test("a status change racing a save keeps the save's words and the new status", async () => {
  const room = await classroom("a4s");
  const made = await save(room.teacher.key, { card: card("race-a4"), decks: [room.deck.id] });
  const held = (await api("my-cards", { key: room.teacher.key })).json.cards.find((/** @type {any} */ c) => c.id === made.id);
  const [s, p] = await Promise.all([
    api("save-card", { key: room.teacher.key, body: { card: { ...held, note: "kept" }, decks: [room.deck.id] } }),
    api("card-status", { key: room.teacher.key, body: { cardId: made.id, to: "published" } }),
  ]);
  assert.equal(s.status, 200, s.text);
  assert.equal(p.status, 200, p.text);
  const now = await raw(`card:${made.id}`);
  assert.equal(now.note, "kept", "the note survived");
  assert.notEqual(now.status, "draft", "and the card is published");
  assert.equal(now.rev, (made.rev || 1) + 2);
});

/* ------------------------------------------------ A5: deck membership as a change */

test("adding to one deck and removing from another at once leaves both changes", async () => {
  const room = await classroom("a5");
  const d2 = (await api("create-deck", { key: room.teacher.key, body: { title: "Second a5", lang: "ar-PS" } })).json.deck;
  const d1 = room.deck.id;
  const made = await save(room.teacher.key, { card: card("move-a5"), decks: [d1] });
  const held = (await api("my-cards", { key: room.teacher.key })).json.cards.find((/** @type {any} */ c) => c.id === made.id);
  const [add, remove] = await Promise.all([
    api("save-card", { key: room.teacher.key, body: { card: held, decks: [d1, d2.id], decksWere: [d1] } }),
    api("save-card", { key: room.teacher.key, body: { card: held, decks: [], decksWere: [d1] } }),
  ]);
  assert.equal(add.status, 200, add.text);
  assert.equal(remove.status, 200, remove.text);
  assert.deepEqual((await raw(`card:${made.id}`)).inDecks, [d2.id]);
  assert.ok((await raw(`deck:${d2.id}`)).cardIds.includes(made.id));
  assert.ok(!(await raw(`deck:${d1}`)).cardIds.includes(made.id));
});

test("a stale screen removing one deck leaves the deck it never knew about", async () => {
  const room = await classroom("a5b");
  const d2 = (await api("create-deck", { key: room.teacher.key, body: { title: "Other a5b", lang: "ar-PS" } })).json.deck;
  const d1 = room.deck.id;
  const made = await save(room.teacher.key, { card: card("stale-a5"), decks: [d1, d2.id] });
  const held = (await api("my-cards", { key: room.teacher.key })).json.cards.find((/** @type {any} */ c) => c.id === made.id);
  /* The screen believed the card was in d1 alone. */
  const r = await api("save-card", { key: room.teacher.key, body: { card: held, decks: [], decksWere: [d1] } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual((await raw(`card:${made.id}`)).inDecks, [d2.id]);
  /* An older build, sending no decksWere, still sets the list outright. */
  const old = await api("save-card", { key: room.teacher.key, body: { card: held, decks: [d1] } });
  assert.deepEqual(old.json.card.decks, [d1]);
});

/* ------------------------------------------- A6: index lists, conditionally */

test("deleting one deck while another is made never loses the new one", async () => {
  const room = await classroom("a6");
  for (let i = 0; i < 20; i++) {
    const doomed = (await api("create-deck", { key: room.teacher.key, body: { title: `Doomed ${i}`, lang: "ar-PS" } })).json.deck;
    const [, made] = await Promise.all([
      api("delete-deck", { key: room.teacher.key, body: { deckId: doomed.id } }),
      api("create-deck", { key: room.teacher.key, body: { title: `Kept ${i}`, lang: "ar-PS" } }),
    ]);
    assert.equal(made.status, 200, made.text);
    const listed = (await api("my-decks", { key: room.teacher.key })).json.decks.map((/** @type {any} */ d) => d.id);
    assert.ok(listed.includes(made.json.deck.id), `round ${i}: the new deck is listed`);
    assert.ok(!listed.includes(doomed.id), `round ${i}: the deleted one is not`);
  }
});

test("decks made and deleted all at once leave the index exactly right", async () => {
  const room = await classroom("a6b");
  const doomed = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    api("create-deck", { key: room.teacher.key, body: { title: `Gone ${i}`, lang: "ar-PS" } })));
  for (const d of doomed) assert.equal(d.status, 200, d.text);
  /* Ten made, ten deleted, at the same moment: each read the index and
     wrote it back whole before 0.580, so most of them were lost. */
  const [made] = await Promise.all([
    Promise.all(Array.from({ length: 10 }, (_, i) =>
      api("create-deck", { key: room.teacher.key, body: { title: `Made ${i}`, lang: "ar-PS" } }))),
    Promise.all(doomed.map((d) => api("delete-deck", { key: room.teacher.key, body: { deckId: d.json.deck.id } }))),
  ]);
  for (const m of made) assert.equal(m.status, 200, m.text);
  const index = await raw("index:decks");
  for (const m of made) assert.ok(index.includes(m.json.deck.id), "every new deck is in the index");
  for (const d of doomed) assert.ok(!index.includes(d.json.deck.id), "and no deleted one");
});

/* ------------------------------------------------- A8: cacheable media */

test("recordings and pictures are served cacheable, and nothing else is", async () => {
  const room = await classroom("a8");
  const hash = "b".repeat(64);
  const put = await api("put-clip", { key: room.teacher.key, body: { hash, data: "data:audio/webm;base64,BBBB" } });
  assert.equal(put.headers.get("cache-control"), "no-store");
  const clip = await api("clip", { key: room.teacher.key, params: { hash } });
  assert.equal(clip.status, 200);
  assert.equal(clip.headers.get("cache-control"), "private, max-age=31536000, immutable");
  const missing = await api("clip", { key: room.teacher.key, params: { hash: "c".repeat(64) } });
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("cache-control"), "no-store", "a miss is not kept");

  const img = "d".repeat(64);
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const putImage = await api("put-image", { key: room.teacher.key, body: { hash: img, data: png } });
  assert.equal(putImage.status, 200, putImage.text);
  const image = await api("image", { key: room.teacher.key, params: { hash: img } });
  assert.equal(image.headers.get("cache-control"), "private, max-age=31536000, immutable");
});

/* ----------------------------------------------- A9: "nothing moved" answers */

test("a teacher's lists answer 304 when nothing moved, and 200 once something did", async () => {
  const room = await classroom("a9");
  for (const action of ["my-cards", "my-decks", "my-courses"]) {
    const firstAsk = await api(action, { key: room.teacher.key });
    const etag = firstAsk.headers.get("etag");
    assert.ok(etag, `${action} carries an ETag`);
    const again = await api(action, { key: room.teacher.key, headers: { "if-none-match": String(etag) } });
    assert.equal(again.status, 304, `${action} answers 304 when nothing moved`);
  }
  const before = await api("my-cards", { key: room.teacher.key });
  await save(room.teacher.key, { card: card("moved-a9"), decks: [] });
  const after = await api("my-cards", { key: room.teacher.key, headers: { "if-none-match": String(before.headers.get("etag")) } });
  assert.equal(after.status, 200);
  assert.notEqual(after.headers.get("etag"), before.headers.get("etag"));

  const overview = await api("admin-overview", { key: admin.key });
  const quiet = await api("admin-overview", { key: admin.key, headers: { "if-none-match": String(overview.headers.get("etag")) } });
  assert.equal(quiet.status, 304);
});

/* ------------------------------------- A10: one space's removal, the other kept */

test("removing someone from one space leaves their personal material in the other", async () => {
  const made = await api("admin-create-org", { key: admin.key, body: { name: "Cee", slug: "cee-space", adminName: "Cy" } });
  assert.equal(made.status, 200, made.text);
  const C = made.json.org.id;
  /* The App admin adds themselves to C, keeps a card in My space in each
     space, and leaves C: the walk that takes one space away. */
  assert.equal((await api("admin-add-member", { key: admin.key, body: { handle: admin.handle, org: C } })).status, 200);
  const mainCard = await save(admin.key, { card: card("mine-main-a10"), decks: [], personal: true });
  const cCard = await api("save-card", { key: admin.key, org: C, body: { card: card("mine-c-a10"), decks: [], personal: true } });
  assert.equal(cCard.status, 200, cCard.text);
  const left = await api("leave-space", { key: admin.key, org: C, body: {} });
  assert.equal(left.status, 200, left.text);
  assert.equal(await raw(`card:${cCard.json.card.id}`), null, "their My space card in C went");
  assert.ok(await raw(`card:${mainCard.id}`), "their My space card in Main stayed");
  assert.ok((await raw(`mycards:${admin.handle}`)).includes(mainCard.id), "and is still on their list");
});
