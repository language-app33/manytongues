// @ts-check
/*
 * A course's switches (0.627).
 *
 * Each course can say which exercises its students are asked: four
 * shortcuts — With translation, Little translation, No translation and
 * Custom — and a switch per exercise. These are the rules, one sentence a
 * test, read through the app's one door (availableTypes) the way a session
 * and the progress screens read them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildOnce } from "./helpers.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const built = await buildOnce(["ArabicTrainer.tsx"]);
const T = await import(path.join(built, "ArabicTrainer.js"));
const P = await import(path.join(here, "..", "src", "course-practice.ts"));
const { standing } = await import(path.join(here, "..", "src", "scheduler.ts"));
const { typeOf } = await import(path.join(here, "..", "src", "languages.ts"));

const settings = { language: "ar-PS" };
T.setOfflineNow(false);
T.setAudibleClips(null);

const NOW = Date.UTC(2026, 10, 14, 9);
const DAY = 86400000;
/** A state right twice running, with `passes`. */
const solidState = (passes = 0) => ({
  phase: "review", step: 0, ease: 2.5, interval: 10, due: NOW + 5 * DAY, reps: 3, lapses: 0,
  right: 3, wrong: 0, skips: 0, near: 0, hints: 0, hist: [1, 1, 1], passes, updated: NOW - DAY,
});

/** A word card from a course: `k` its server id. */
const word = (/** @type {string} */ k, /** @type {Record<string, any>} */ extra = {}, s = {}) => ({
  id: `srv${k}`, kind: "word", tags: ["Deck"], created: 1, updated: 1, lang: "ar-PS",
  source: { cardId: k, courseId: "c1", deckId: "d1" },
  forms: [{ id: `srv${k}`, ar: `كلمة${k}`, en: `word ${k}`, lat: `kalima${k}`, lang: "ar-PS", recs: [], s, ...extra }],
});
const rec = (/** @type {string} */ id) => [{ id, label: "", speed: "", mime: "", size: 0, dur: 0 }];

/* Enough company for choosing and matching, and pictures among them. */
const company = Array.from({ length: 8 }, (_, i) => word(`p${i}`, { images: [`h${i}`] }));
const plain = word("plain");
const pictured = word("pic", { images: ["hpic"] });
const heard = word("heard", { recs: rec("clip-heard") });

const DECK = { id: "d1", cardIds: ["plain", "pic", "heard", ...company.map((c) => c.source.cardId)] };

/** Installs the cards with these courses and gives back each form's types. */
function under(/** @type {any[]} */ courses, /** @type {any[]} */ items = [plain, pictured, heard, ...company], decks = [DECK]) {
  T.installIndexes(items, settings, [], { courses, decks });
  return (/** @type {any} */ it) => [...new Set(T.laddered(it.forms[0], settings).map(typeOf))].sort();
}
const course = (/** @type {any} */ practice, decks = ["d1"], id = "c1") => ({ id, decks, ...(practice ? { practice } : null) });

test("with no switches, a course's cards are asked exactly what they were", () => {
  const before = under([]);
  const want = [plain, pictured, heard].map(before);
  const after = under([course(null)]);
  assert.deepEqual([plain, pictured, heard].map(after), want);
  const withMode = under([course({ mode: "with", off: [] })]);
  assert.deepEqual([plain, pictured, heard].map(withMode), want, "With translation is everything on");
});

test("No translation asks no exercise that uses English", () => {
  const ask = under([course({ mode: "none", off: [] })]);
  for (const it of [pictured, heard]) {
    const types = ask(it);
    assert.ok(types.length > 0, `${it.id} is still asked`);
    for (const t of types) assert.equal(P.usesEnglish(t), false, `${it.id} asked ${t}`);
  }
});

test("No translation does not ask a word with nothing but English to teach it", () => {
  const ask = under([course({ mode: "none", off: [] })]);
  assert.deepEqual(ask(plain), []);
  assert.ok(ask(pictured).includes("img2ar"), "a picture teaches it");
  assert.ok(ask(heard).includes("rec2ar"), "so does a recording");
});

test("Little translation drops an English exercise only where its level has one without English", () => {
  const all = under([])(pictured);
  const ask = under([course({ mode: "little", off: [] })]);
  const got = ask(pictured);
  assert.ok(all.includes("en2ar") && all.includes("img2ar"));
  assert.equal(got.includes("en2ar"), false, "writing from English goes, writing from the picture stays");
  assert.ok(got.includes("img2ar"));
  assert.equal(got.includes("en2pick"), false, "choosing from English goes, choosing from the picture stays");
  assert.ok(got.includes("ar2en") || got.includes("ar2pick"), "the meaning in English stays where nothing else asks it");
  assert.deepEqual(ask(plain), under([])(plain), "a word with nothing else keeps its English");
});

test("a switch the teacher turns off is not asked, and Custom unlocks the English ones", () => {
  const off = under([course({ mode: "with", off: ["tr2ar", "en2ar"] })]);
  assert.equal(off(plain).includes("tr2ar"), false);
  assert.ok(off(plain).includes("en2ar"), "a shortcut's lock wins over the list");
  const custom = under([course({ mode: "custom", off: ["en2ar"] })]);
  assert.equal(custom(plain).includes("en2ar"), false);
});

test("a card in two courses is asked what either allows", () => {
  const two = { ...DECK, id: "d2" };
  const ask = under([course({ mode: "none", off: [] }, ["d1"]), course(null, ["d2"], "c2")], undefined, [DECK, two]);
  assert.deepEqual(ask(plain), under([])(plain));
});

test("a learner's own cards are not touched by any course", () => {
  const own = { ...plain, id: "mine1", source: undefined, forms: [{ ...plain.forms[0], id: "mine1" }] };
  const ask = under([course({ mode: "none", off: [] })], [own, plain, pictured, ...company]);
  assert.deepEqual(ask(own), under([], [own, plain, pictured, ...company])(own));
});

test("a level with nothing allowed is passed through", () => {
  /* No translation leaves the pictured word nothing on the first level;
     with the levels above it solid, it is cleared. */
  const ask = under([course({ mode: "none", off: [] })]);
  const keys = T.laddered(pictured.forms[0], settings);
  const s = Object.fromEntries(keys.map((/** @type {string} */ k) => [k, solidState()]));
  const done = { ...pictured, forms: [{ ...pictured.forms[0], s }] };
  under([course({ mode: "none", off: [] })], [plain, done, heard, ...company]);
  assert.ok(ask(pictured).length > 0);
  assert.notEqual((standing(T.cardStandings(done, settings)) || {}).status, "learning");
});

/* ---------------- no card loses its status across a flip ---------------- */

/** The status a card shows, under these courses. */
function statusOf(/** @type {any} */ it, /** @type {any[]} */ courses) {
  T.installIndexes([it, plain, pictured, ...company], settings, [], { courses, decks: [DECK] });
  const at = standing(T.cardStandings(it, settings));
  return at ? `${at.status}@${at.level}` : "none";
}

test("a card learnt with everything on is still learnt with English switched off", () => {
  /* Every key it climbs with all on, solid, its top made two passes. */
  T.installIndexes([heard, plain, pictured, ...company], settings, [], { courses: [course(null)], decks: [DECK] });
  const keys = T.laddered(heard.forms[0], settings);
  const s = Object.fromEntries(keys.map((/** @type {string} */ k) => [k, solidState(2)]));
  const learnt = { ...heard, forms: [{ ...heard.forms[0], s }] };
  const before = statusOf(learnt, [course(null)]);
  assert.match(before, /^done/);
  for (const mode of ["little", "none", "custom"]) {
    const off = mode === "custom" ? P.ENGLISH_TYPES : [];
    assert.equal(statusOf(learnt, [course({ mode, off })]), before, `${mode}`);
  }
});

test("a card cleared with English off is still cleared, and learnt still learnt, when English comes back on", () => {
  const none = [course({ mode: "none", off: [] })];
  T.installIndexes([heard, plain, pictured, ...company], settings, [], { courses: none, decks: [DECK] });
  const keys = T.laddered(heard.forms[0], settings);
  for (const passes of [1, 2]) {
    const s = Object.fromEntries(keys.map((/** @type {string} */ k) => [k, solidState(passes)]));
    const it = { ...heard, forms: [{ ...heard.forms[0], s }] };
    const before = statusOf(it, none);
    assert.match(before, passes === 2 ? /^done/ : /^cleared/);
    assert.equal(statusOf(it, [course({ mode: "with", off: [] })]), before, `${passes} passes, English back on`);
    /* Custom with everything on is the other way back. A course's record
       is never taken away once set: going back to With translation keeps
       one, which is what this reading needs. */
    assert.equal(statusOf(it, [course({ mode: "custom", off: [] })]), before, `${passes} passes, all on by hand`);
  }
});

test("the question switched back on is asked, and a slip on it still counts as a slip", () => {
  const none = [course({ mode: "none", off: [] })];
  T.installIndexes([heard, plain, pictured, ...company], settings, [], { courses: none, decks: [DECK] });
  const keys = T.laddered(heard.forms[0], settings);
  const s = Object.fromEntries(keys.map((/** @type {string} */ k) => [k, solidState(2)]));
  const it = { ...heard, forms: [{ ...heard.forms[0], s }] };
  const on = [course({ mode: "with", off: [] })];
  T.installIndexes([it, plain, pictured, ...company], settings, [], { courses: on, decks: [DECK] });
  assert.ok(T.laddered(it.forms[0], settings).includes("en2ar"), "it joins what the card is asked");
  const slipped = { ...it, forms: [{ ...it.forms[0], s: { ...s, en2ar: { ...solidState(), hist: [0, 0], right: 0, wrong: 2 } } }] };
  assert.doesNotMatch(statusOf(slipped, on), /^(done|cleared)/, "wrong twice running takes it back");
});

test("switching never touches a stored record", () => {
  const s = { ar2en: solidState(2), en2ar: solidState(2) };
  const it = { ...plain, forms: [{ ...plain.forms[0], s }] };
  const copy = JSON.stringify(it);
  for (const mode of ["with", "little", "none", "custom"]) {
    statusOf(it, [course({ mode, off: ["tr2ar"] })]);
    T.buildSession({ items: [it, ...company], settings, inDeck: () => true });
  }
  assert.equal(JSON.stringify(it), copy);
});

/* ---------------- the teacher's counts ---------------- */

test("the course page counts the words that cannot be taught without English", () => {
  const cards = [
    { id: "a", lang: "ar-PS", forms: [{ ar: "بيت", en: "house", lat: "beit" }] },
    { id: "b", lang: "ar-PS", forms: [{ ar: "باب", en: "door", lat: "bab", images: ["x"] }] },
    { id: "c", lang: "ar-PS", forms: [{ ar: "كلب", en: "dog", lat: "kalb", clips: ["y"] }] },
    { id: "d", lang: "ar-PS", forms: [{ ar: "قطة", en: "cat", lat: "otta" }] },
    { id: "e", lang: "ar-PS", sentence: true, uses: ["d"], forms: [{ ar: "القطة هون", en: "the cat is here", lat: "" }] },
  ];
  assert.deepEqual(P.untaughtWithoutEnglish(cards).map((/** @type {any} */ c) => c.id), ["a"], "a phrase teaches d");
  assert.equal(P.withoutQuestions(cards, { mode: "none", off: [] }), 1);
  assert.equal(P.withoutQuestions(cards, { mode: "with", off: [] }), 0);
  assert.equal(P.withoutQuestions(cards, null), 0);
});

test("how much English a question shows: the most any of the card's courses allows", () => {
  const none = { mode: "none", off: [] };
  const little = { mode: "little", off: [] };
  assert.equal(P.englishShown([]), "shown", "a learner's own card");
  assert.equal(P.englishShown([none]), "hidden");
  assert.equal(P.englishShown([little]), "tap");
  assert.equal(P.englishShown([little, none]), "tap");
  assert.equal(P.englishShown([none, null]), "shown", "a course with no switches shows it");
  assert.equal(P.englishShown([{ mode: "custom", off: P.ENGLISH_TYPES }]), "hidden");
  assert.equal(P.englishShown([{ mode: "custom", off: ["en2ar"] }]), "shown");
  T.installIndexes([plain, ...company], settings, [], { courses: [course(none)], decks: [DECK] });
  assert.equal(T.englishModeFor(plain.id), "hidden");
  assert.equal(T.englishModeFor(`${plain.id}-f~pl`), "hidden", "for every form of it");
  assert.equal(T.englishModeFor("mine"), "shown");
});
