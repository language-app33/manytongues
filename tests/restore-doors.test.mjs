/*
 * Which door takes which file (0.583; docs/PLAN-space-backup.md, B8.14).
 *
 * Super admin → App restores the site's files; Super admin → Spaces restores
 * one space's. A file made before files said whose they were is the site's.
 * And what the restore and its preview are sent: the owner's choices and the
 * file's facts, never the file's records whole.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildOnce } from "./helpers.mjs";

const built = await buildOnce(["spaces.tsx"]);
const { fileScope, doorRefusal, restoreOptionsFor, previewBody, BACKUP_PARTS, sizeWords, partBytes } = await import(path.join(built, "spaces.js"));

const site = { format: "language-app-backup", manifest: { version: 1, scope: { kind: "site" }, indexes: { orgs: ["main", "b1"] } }, records: {} };
const old = { format: "language-app-backup", manifest: { version: 1, indexes: {} }, records: {} };
const spaceB = {
  format: "language-app-backup",
  manifest: { version: 1, scope: { kind: "space", space: "b1", slug: "bee", name: "Bee" }, indexes: { orgs: ["b1"] } },
  records: {
    "user:ann-1": { handle: "ann-1", created: 5, orgs: ["b1"], displayName: "Ann", keyHash: "secret" },
    "course:c1": { id: "c1", org: "b1", title: "C", teachers: ["ann-1"], students: [], code: "x" },
    "card:k1": { id: "k1", forms: [] },
    "org:b1": { id: "b1", slug: "bee", name: "Bee", inviteCode: "zzz" },
  },
};

test("a file says whose it is; one that says nothing is the site's", () => {
  assert.deepEqual(fileScope(site), { kind: "site" });
  assert.deepEqual(fileScope(old), { kind: "site" });
  assert.equal(fileScope(spaceB).kind, "space");
  assert.equal(fileScope(spaceB).space, "b1");
});

test("each door refuses the other's files", () => {
  assert.equal(doorRefusal(site, { kind: "site" }), "");
  assert.equal(doorRefusal(old, { kind: "site" }), "");
  assert.match(doorRefusal(spaceB, { kind: "site" }), /space Bee.*Spaces/);
  assert.match(doorRefusal(site, { kind: "space", space: "b1" }), /whole site/);
  assert.match(doorRefusal(old, { kind: "space" }), /whole site/);
  assert.match(doorRefusal(spaceB, { kind: "space", space: "c9", name: "Cee" }), /not of Cee/);
  assert.equal(doorRefusal(spaceB, { kind: "space", space: "b1" }), "");
  assert.equal(doorRefusal(spaceB, { kind: "space" }), "", "the door for a space that is gone takes any space's file");
});

test("a restore is sent choices and facts, never verdicts", () => {
  const o = restoreOptionsFor(spaceB, { kind: "space", space: "b1" }, { bringBack: ["ann-1"] });
  assert.deepEqual(o.scope, { kind: "space", space: "b1" });
  assert.deepEqual(o.created, { "ann-1": 5 });
  assert.deepEqual(o.bringBack, ["ann-1"]);
  assert.equal(o.keepSpaceCard, true, "the space keeps its own card unless asked");
  assert.deepEqual(o.fileOrgs, ["b1"]);
  assert.deepEqual(restoreOptionsFor(site, { kind: "site" }).scope, { kind: "site" });
});

test("the preview is sent only the fields it needs", () => {
  const body = previewBody(spaceB, restoreOptionsFor(spaceB, { kind: "space", space: "b1" }));
  assert.deepEqual(body.users, [{ handle: "ann-1", created: 5, orgs: ["b1"], org: undefined, displayName: "Ann" }]);
  assert.equal(JSON.stringify(body).includes("secret"), false, "no key fingerprints");
  assert.equal(JSON.stringify(body).includes("zzz"), false, "no codes");
  assert.deepEqual(body.keys.cards, ["k1"]);
  assert.deepEqual(body.orgs, [{ id: "b1", slug: "bee", name: "Bee" }]);
  const wordsOnly = previewBody(spaceB, restoreOptionsFor(spaceB, { kind: "site" }), ["cards"]);
  assert.deepEqual(wordsOnly.courses, [], "a part not being put back is not previewed");
});

test("Progress is a part of every backup, with its practice recordings", () => {
  const p = BACKUP_PARTS.find((/** @type {any} */ x) => x.key === "progress");
  assert.ok(p);
  assert.deepEqual(p.prefixes, ["progress:", "paudio:"]);
});

test("each part says how large it makes the file, in words a person reads", () => {
  const manifest = { bytes: { card: 3000, owncards: 72, system: 0, clip: 5 * 1024 * 1024, image: 1024 * 1024 } };
  const cards = BACKUP_PARTS.find((/** @type {any} */ x) => x.key === "cards");
  const media = BACKUP_PARTS.find((/** @type {any} */ x) => x.key === "clips");
  assert.equal(partBytes(manifest, cards), 3072);
  assert.equal(sizeWords(partBytes(manifest, cards)), "3 KB");
  assert.equal(sizeWords(partBytes(manifest, media)), "6.0 MB");
  assert.equal(sizeWords(0), "nothing");
  assert.equal(sizeWords(10), "under 1 KB");
  assert.equal(partBytes({}, cards), 0, "a manifest from before sizes says nothing");
});

test("one space's backup speaks of that space, not of every space", () => {
  for (const p of BACKUP_PARTS) assert.ok(p.spaceWhat, `${p.key} has words for one space`);
  const spaces = BACKUP_PARTS.find((/** @type {any} */ x) => x.key === "spaces");
  assert.equal(spaces.spaceTitle, "The space itself");
  assert.doesNotMatch(spaces.spaceWhat, /each space/i);
});
