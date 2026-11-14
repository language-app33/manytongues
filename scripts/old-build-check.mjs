// @ts-nocheck — a harness run by hand, not part of the app.
// Real build against data from later releases (0.626, stage A of the plan).
// node scripts/old-build-check.mjs <clientTree> <serverTree> <port> <label>
// clientTree must have dist/ built. Starts the server from serverTree with the
// client's dist, makes a course with one published word card and a student,
// puts on the stored records what later stages add (a progress record for an
// unknown exercise, a Description on the card, switches on the course), then
// drives the real app in Chromium as the student: load, a session, save, sync
// both ways, course refresh. Then a teacher's save of the card as an older
// editor sends it. Then reads the server's copies.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)("playwright");

const [clientTree, serverTree, port, label] = process.argv.slice(2);
const origin = `http://127.0.0.1:${port}`;
const data = await mkdtemp(path.join(tmpdir(), `oldbuild-${label}-`));
const ADMIN_KEY = "k-admin";
const log = (...a) => console.log(`[${label}]`, ...a);

let server;
async function start() {
  server = spawn("node", [path.join(serverTree, "server", "index.js")], {
    env: { ...process.env, DATA_DIR: data, DIST_DIR: path.join(clientTree, "dist"), PORT: port, ADMIN_KEY },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr.on("data", (d) => process.env.VERBOSE && process.stderr.write(d));
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("server did not start");
}
async function stop() {
  server.kill();
  await new Promise((r) => server.once("exit", r));
}
const raw = async (p, { method = "GET", key, body, headers = {} } = {}) => {
  const res = await fetch(`${origin}${p}`, { method, headers: { "content-type": "application/json", ...(key ? { "x-key": key } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text), text }; } catch { return { status: res.status, json: null, text }; }
};
const post = (a, key, body = {}) => raw(`/api/courses?action=${a}`, { method: "POST", key, body });
const must = (r, what) => { if (r.status !== 200) throw new Error(`${what}: ${r.status} ${r.text.slice(0, 300)}`); return r.json; };
const storeFile = (store, key) => path.join(data, encodeURIComponent(store), encodeURIComponent(key));

await start();
/* A teacher who is the site's admin, a course, a unit, a published word. */
const owner = must(await post("signup", null, { displayName: "Teacher" }), "signup");
must(await post("claim-admin", owner.key, { adminKey: ADMIN_KEY }), "claim");
const orgs = must(await raw("/api/courses?action=admin-orgs", { key: owner.key }), "orgs");
const invite = orgs.orgs.find((o) => o.id === "main").inviteCode;
const course = must(await post("create-course", owner.key, { title: "Arabic", language: "ar-PS" }), "course").course;
const unit = must(await post("create-deck", owner.key, { title: "Unit 1", lang: "ar-PS" }), "deck").deck;
must(await post("attach-deck", owner.key, { courseId: course.id, deckId: unit.id }), "attach");
const saved = [];
for (const [ar, en, lat] of [["بيت", "house", "beit"], ["باب", "door", "bab"], ["كلب", "dog", "kalb"], ["قطة", "cat", "otta"], ["ماي", "water", "mayy"]]) {
  const r = must(await post("save-card", owner.key, { card: { id: "", lang: "ar-PS", category: "noun", forms: [{ ar, en, lat }] }, decks: [unit.id], publish: true }), "card");
  saved.push(r.card);
}
const card = saved[0];
const student = must(await post("signup", null, { displayName: "Student", code: invite }), "student");
must(await post("assign-student", owner.key, { courseId: course.id, handle: student.user.handle }), "enrol");

/* The student's document as the server holds it: the first card already
   held, with a record for an exercise this release does not know. */
const token = createHash("sha256").update(student.key).digest("hex");
const FUTURE = { phase: "review", step: 0, ease: 2.5, interval: 3, due: Date.now() + 3 * 86400000, reps: 2, lapses: 0, right: 2, wrong: 0, skips: 0, near: 0, hints: 0, hist: [1, 1], updated: Date.now() - 86400000 };
const localId = `srv${card.id}`;
const doc = {
  version: 3,
  items: [{
    id: localId, kind: "word", tags: ["Unit 1"], lang: "ar-PS", created: 1, updated: 1,
    source: { cardId: card.id, courseId: course.id, deckId: unit.id },
    forms: [{ id: localId, ar: "بيت", en: "house", lat: "beit", lang: "ar-PS", s: { zzfuture: FUTURE, "zzfuture@1": FUTURE } }],
  }],
  tombstones: {}, parked: {}, log: {}, settings: { language: "ar-PS" }, settingsUpdated: 1,
};
const pushed = await raw("/api/sync", { method: "POST", headers: { "x-sync-token": token }, body: { etag: null, data: doc } });
log("seeded student document:", pushed.status);
await stop();

/* What later stages add to teacher material, written onto the stored records. */
const cardPath = storeFile("arabic-courses", `card:${card.id}`);
const coursePath = storeFile("arabic-courses", `course:${course.id}`);
const DESCRIPTION = "مكان بنعيش فيه";
const SWITCHES = { ar2en: false, en2ar: false };
const c0 = JSON.parse(await readFile(cardPath, "utf8"));
await writeFile(cardPath, JSON.stringify({ ...c0, description: DESCRIPTION }));
const k0 = JSON.parse(await readFile(coursePath, "utf8"));
await writeFile(coursePath, JSON.stringify({ ...k0, switches: SWITCHES }));
await start();

/* The real app, as the student. */
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(origin);
await page.evaluate((acct) => localStorage.setItem("arabic-account", JSON.stringify(acct)), { ...student.user, key: student.key });
await page.reload();
await page.waitForTimeout(8000);
await page.screenshot({ path: (process.env.SHOTS || tmpdir()) + "/" + label + "-loaded.png" });
log("loaded");
/* A session: answer whatever is asked, a few times. */
let answered = 0;
for (let round = 0; round < 3; round++) {
  const start = page.getByRole("button", { name: /^(start|practise|practice|begin|continue)/i }).first();
  if (await start.isVisible().catch(() => false)) await start.click({ timeout: 2000 }).catch(() => {});
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(400);
    const box = page.locator("main input:not([type=hidden]):not([type=checkbox]), input[placeholder], textarea").first();
    if (await box.isVisible().catch(() => false)) {
      await box.fill("house", { timeout: 2000 }).catch(() => {});
      await box.press("Enter", { timeout: 2000 }).catch(() => {});
      answered++;
      continue;
    }
    const tile = page.getByRole("button", { name: /^i don.t know/i }).first();
    if (await tile.isVisible().catch(() => false)) { await tile.click({ timeout: 2000 }).catch(() => {}); answered++; continue; }
    const next = page.getByRole("button", { name: /^(next|continue|done|finish|got it|check)/i }).first();
    if (await next.isVisible().catch(() => false)) { await next.click({ timeout: 2000 }).catch(() => {}); continue; }
  }
}
log("answers given in the app:", answered);
await page.screenshot({ path: (process.env.SHOTS || tmpdir()) + "/" + label + "-after.png" });
await page.waitForTimeout(6000);
/* Reload: load from storage, sync, refresh again. */
await page.reload();
await page.waitForTimeout(10000);
const local = await page.evaluate(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.includes("arabic-trainer-v3")) out[k] = localStorage.getItem(k); }
  return out;
});
await browser.close();

/* A teacher's save of the card, as an older editor builds it: field by
   field, with nothing it does not know. */
const mine = must(await raw(`/api/courses?action=my-cards`, { key: owner.key }), "my-cards");
const seen = (mine.cards || []).find((c) => c.id === card.id);
const sent = { id: card.id, lang: seen.lang, category: seen.category, name: seen.name, note: seen.note || "", forms: seen.forms.map((f) => ({ id: f.id, ar: f.ar, en: f.en, lat: f.lat, answers: f.answers })) };
const teacherSave = await post("save-card", owner.key, { card: { ...sent, note: "edited" }, decks: [unit.id], publish: true });
log("teacher's save:", teacherSave.status);

/* What the server holds now. */
const server1 = await raw("/api/sync", { headers: { "x-sync-token": token } });
const item = ((server1.json && (server1.json.data || server1.json).items) || []).find((it) => it.id === localId);
const states = item ? item.forms[0].s : {};
await stop();
const cardNow = JSON.parse(await readFile(cardPath, "utf8"));
const courseNow = JSON.parse(await readFile(coursePath, "utf8"));
const localDoc = Object.values(local).map((v) => { try { return JSON.parse(v); } catch { return null; } }).find((d) => d && Array.isArray(d.items));
const localItem = localDoc && localDoc.items.find((it) => it.id === localId);
const report = {
  label,
  serverKeptUnknownRecord: JSON.stringify(states.zzfuture) === JSON.stringify(FUTURE) && JSON.stringify(states["zzfuture@1"]) === JSON.stringify(FUTURE),
  deviceKeptUnknownRecord: !!(localItem && localItem.forms[0].s && localItem.forms[0].s.zzfuture),
  progressKeysOnServer: Object.keys(states),
  studentHasAllCards: ((server1.json && (server1.json.data || server1.json).items) || []).length,
  descriptionKept: cardNow.description === DESCRIPTION,
  switchesKept: JSON.stringify(courseNow.switches) === JSON.stringify(SWITCHES),
  teacherEditLanded: cardNow.note === "edited",
  pageErrors: errors,
};
console.log(JSON.stringify(report, null, 1));
