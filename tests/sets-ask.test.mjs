// @ts-check
/*
 * Practising a personal set's picture (0.631), through the trainer's own
 * seams: installIndexes, castQuestion, the exercises a form offers, and
 * buildSession.
 *
 * The worked example of docs/PLAN-personal-sets.md: a course with "Our
 * family" (pictures Lan, Minh, Hoa and Tuan), and two lists, Hanoi and
 * Saigon. Written here in Arabic script, the course's language; nothing
 * about the rules depends on which.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildOnce } from "./helpers.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const built = await buildOnce(["ArabicTrainer.tsx"]);
const T = await import(path.join(built, "ArabicTrainer.js"));
const syncDir = await buildOnce(["sync.ts"]);
const { mergeData, compactItem } = await import(path.join(syncDir, "sync.js"));
const S = await import(path.join(here, "..", "src", "sets.ts"));

const settings = { language: "ar-PS" };
const NOW = Date.UTC(2026, 10, 15, 9);
const H = (/** @type {string} */ c) => c.repeat(64);

/** A schedule answered right `right` times. */
const st = (/** @type {number} */ right, extra = {}) => ({
  phase: "learning", step: 0, ease: 2.5, interval: 0, due: NOW - 1, reps: right, lapses: 0, right, wrong: 0,
  skips: 0, near: 0, hints: 0, hist: Array(right).fill(1), updated: NOW - 1000, ...extra,
});

/** @param {string} module @param {string} id @param {Record<string, any>} form */
const card = (module, id, form, s = {}) => ({
  id: `srv${id}`, tags: [module], created: 1, updated: 1, lang: "ar-PS", kind: "word",
  source: { courseId: "c1", deckId: module, cardId: id, rev: 1 },
  forms: [{ id: `srv${id}`, lat: "", lang: "ar-PS", s, ...form }],
});
const picture = (/** @type {string} */ id, /** @type {string} */ ar, /** @type {string[]} */ images, s = {}, extra = {}) =>
  card("dFam", id, { ar, en: "", images, ...extra }, s);
const word = (/** @type {string} */ module, /** @type {string} */ id, /** @type {string} */ ar, /** @type {string} */ en, extra = {}) =>
  card(module, id, { ar, en, ...extra });

const answer = (/** @type {any} */ a) => ({ [S.SET_KEY]: { updated: NOW - 5000, list: "dHanoi", ...a } });

const HANOI = [
  word("dHanoi", "w1", "عمة", "father's younger sister", { recs: [{ id: H("a"), label: "", speed: "regular" }], voices: { [H("a")]: "Mai" } }),
  word("dHanoi", "w2", "جدة", "grandmother"),
  word("dHanoi", "w3", "أم", "mother"),
  word("dHanoi", "w4", "خال", "mother's brother"),
];
const SAIGON = [
  word("dSaigon", "s1", "خالة", "father's younger sister"),
  word("dSaigon", "s2", "ستي", "grandmother"),
  word("dSaigon", "s3", "ماما", "mother"),
  word("dSaigon", "s4", "خالو", "mother's brother"),
];

/** The four pictures, each with the answers given. */
function pictures(/** @type {Record<string, any>} */ answers = {}, /** @type {Record<string, any>} */ states = {}) {
  return [
    picture("Lan", "لان", [H("1"), H("2"), H("3")], { ...(states.Lan || {}), ...(answers.Lan ? answer(answers.Lan) : {}) },
      { recs: [{ id: H("b"), label: "", speed: "regular" }], voices: { [H("b")]: "Mai" } }),
    picture("Minh", "مين", [H("4")], { ...(states.Minh || {}), ...(answers.Minh ? answer(answers.Minh) : {}) }),
    picture("Hoa", "هوا", [H("5")], { ...(states.Hoa || {}), ...(answers.Hoa ? answer(answers.Hoa) : {}) }),
    picture("Tuan", "توان", [H("6")], { ...(states.Tuan || {}), ...(answers.Tuan ? answer(answers.Tuan) : {}) }),
  ];
}
const SET = { ...S.emptySet(), lists: ["dHanoi", "dSaigon"], named: ["w1", "w2", "w4", "s1", "s2", "s4"] };
const modules = (set = SET) => [
  { id: "dFam", title: "Our family", lang: "ar-PS", cardIds: ["Lan", "Minh", "Hoa", "Tuan"], set },
  { id: "dHanoi", title: "Hanoi", lang: "ar-PS", cardIds: HANOI.map((w) => w.source.cardId) },
  { id: "dSaigon", title: "Saigon", lang: "ar-PS", cardIds: SAIGON.map((w) => w.source.cardId) },
];
const ALL_ANSWERED = {
  Lan: { meaning: "father's younger sister" },
  Minh: { meaning: "grandmother" },
  Hoa: { meaning: "mother" },
  Tuan: { meaning: "mother's brother" },
};

/** Installs the indexes over these items and decks, and hands them back. */
function install(/** @type {any[]} */ pics, set = SET) {
  const items = [...pics, ...HANOI, ...SAIGON];
  const d = modules(set);
  const sets = T.setViewsOf(items, d);
  T.installIndexes(items, settings, [], { courses: [{ id: "c1", decks: d.map((x) => x.id) }], decks: d }, sets);
  return items;
}
const ask = (/** @type {any[]} */ items, /** @type {string} */ id, type = "img2pick") => T.castQuestion(items, { id: `srv${id}`, type });
const offered = (/** @type {any[]} */ items, /** @type {string} */ id) =>
  T.enabledTypes(items.find((it) => it.id === `srv${id}`).forms[0], settings);

test("Lan takes turns: her name, then the learner's word with her name under the picture, then both", () => {
  const seen = [0, 1, 2].map((right) => {
    const items = install(pictures(ALL_ANSWERED, { Lan: { img2pick: st(right) } }));
    return ask(items, "Lan");
  });
  assert.deepEqual(seen.map((u) => u.ar), ["لان", "عمة", "عمة لان"]);
  assert.equal(seen[1].setCaption, "لان");
  assert.equal(seen[0].setCaption, undefined);
  assert.deepEqual(seen.map((u) => u.setAsk), [S.DEFAULT_WORDING.askName, S.DEFAULT_WORDING.askWord, S.DEFAULT_WORDING.askBoth]);
  assert.ok(seen.every((u) => u.id === "srvLan"), "and every asking is the picture's");
});

test("on the Saigon list, the Saigon word; with the word after the name, after it", () => {
  const saigon = Object.fromEntries(Object.entries(ALL_ANSWERED).map(([k, v]) => [k, { ...v, list: "dSaigon" }]));
  let items = install(pictures(saigon, { Lan: { img2pick: st(1) } }));
  assert.equal(ask(items, "Lan").ar, "خالة");
  items = install(pictures(ALL_ANSWERED, { Lan: { img2pick: st(2) } }), { ...SET, order: "after" });
  assert.equal(ask(items, "Lan").ar, "لان عمة");
});

test("the set's own wording is asked", () => {
  const set = { ...SET, wording: { ...SET.wording, askName: "Who's this?" } };
  const items = install(pictures(ALL_ANSWERED), set);
  assert.equal(ask(items, "Lan").setAsk, "Who's this?");
});

test("an unticked word gives no turn with both; every kind off offers nothing; a skipped picture its name only", () => {
  let items = install(pictures(ALL_ANSWERED, { Hoa: { img2pick: st(2) } }));
  assert.equal(ask(items, "Hoa", "img2pick").ar, "هوا", "mother is not ticked: name, word, name again");
  items = install(pictures(ALL_ANSWERED), { ...SET, asks: { name: false, word: false, both: false } });
  assert.deepEqual(offered(items, "Lan"), []);
  items = install(pictures({ ...ALL_ANSWERED, Lan: { skip: true } }, { Lan: { img2pick: st(1) } }));
  assert.equal(ask(items, "Lan").ar, "لان");
  assert.equal(ask(items, "Lan").setKind, "name");
});

test("a picture is asked only from its picture or its recordings", () => {
  const items = install(pictures(ALL_ANSWERED));
  const types = offered(items, "Lan");
  assert.ok(types.length > 0);
  for (const t of types) assert.ok(["img2pick", "img2ar", "rec2img", "rec2ar"].includes(t), t);
  assert.ok(types.includes("img2pick") && types.includes("img2ar"));
});

test("wrong choices are of the asking's kind, and never the right answer", () => {
  for (const [right, kind] of [[0, "name"], [1, "word"], [2, "both"]]) {
    const items = install(pictures(ALL_ANSWERED, { Lan: { img2pick: st(/** @type {number} */ (right)) } }));
    const u = ask(items, "Lan");
    assert.equal(u.setKind, kind);
    const pool = T.setChoicePool(u, "word").map((/** @type {any} */ f) => f.ar);
    assert.ok(pool.length >= 3, `${kind}: ${pool}`);
    assert.ok(!pool.includes(u.ar), `${kind}: the answer is not among the wrong ones`);
    if (kind === "name") assert.deepEqual(new Set(pool), new Set(["مين", "هوا", "توان"]));
    if (kind === "word") assert.deepEqual(new Set(pool), new Set(["جدة", "أم", "خال"]), "the chosen list's other words, not Saigon's");
    if (kind === "both") assert.ok(pool.includes("جدة مين") && pool.includes("خال توان") && pool.includes("جدة لان"), String(pool));
  }
});

test("a doesn't-apply picture is out of play, and comes back with its progress when the answer changes", () => {
  const lan = { img2pick: st(3) };
  let items = install(pictures({ ...ALL_ANSWERED, Minh: { none: true } }, { Minh: lan }));
  assert.equal(T.setHolds(items.find((it) => it.id === "srvMinh")), true);
  items = install(pictures(ALL_ANSWERED, { Minh: lan }));
  const minh = items.find((it) => it.id === "srvMinh");
  assert.equal(T.setHolds(minh), false);
  assert.deepEqual(minh.forms[0].s.img2pick, lan.img2pick, "with the progress it had");
});

test("with two lists and none chosen, no word held only by a list is in play; with one chosen, the other's are not", () => {
  const unchosen = Object.fromEntries(Object.entries(ALL_ANSWERED).map(([k, v]) => [k, { meaning: v.meaning, list: undefined }]));
  let items = install(pictures(unchosen));
  assert.ok([...HANOI, ...SAIGON].every((w) => T.setHolds(items.find((it) => it.id === w.id))));
  items = install(pictures(ALL_ANSWERED));
  assert.ok(HANOI.every((w) => !T.setHolds(items.find((it) => it.id === w.id))));
  assert.ok(SAIGON.every((w) => T.setHolds(items.find((it) => it.id === w.id))));
  const held = items.filter((it) => !T.setHolds(it));
  const built = T.buildSession({ items: held, settings, inModule: () => true, practice: true, includeAll: true });
  assert.ok(!(built.exercises || []).some((/** @type {any} */ e) => SAIGON.some((w) => w.id === e.id)), "and a session asks none of Saigon's");
});

test("a real change starts that picture again, stamps the reset, and the answer survives a merge with an older copy", () => {
  const items = install(pictures(ALL_ANSWERED, { Lan: { img2pick: st(3) } }));
  const lan = items.find((it) => it.id === "srvLan");
  const at = NOW;
  const again = S.withAnswer(T.restartItem(lan, at), { meaning: "grandmother" }, at);
  assert.equal(again.reset, at);
  assert.equal(again.forms[0].s.img2pick.phase, "new");
  assert.equal(again.forms[0].s[S.SET_KEY].meaning, "grandmother");
  const doc = (/** @type {any} */ x) => ({ items: [x], settings, tombstones: {}, log: {} });
  const wire = (/** @type {any} */ d) => ({ ...d, items: d.items.map(compactItem) });
  const merged = T.merge(mergeData(wire(doc(again)), wire(doc(lan)), at + 1)).items[0].forms[0];
  assert.equal(merged.s[S.SET_KEY].meaning, "grandmother");
  assert.equal(merged.s.img2pick.phase, "new");
});

test("listening: one voice for a pair when one person recorded both, two otherwise; no turn with nothing to play", () => {
  let items = install(pictures(ALL_ANSWERED, { Lan: { rec2ar: st(2) } }));
  let u = ask(items, "Lan", "rec2ar");
  assert.equal(u.setKind, "both");
  assert.deepEqual(u.recSeq, [[H("a")], [H("b")]]);
  assert.equal(T.voiceLineOf(u), "Recorded by Mai");
  const tuan = { ...ALL_ANSWERED };
  items = install(pictures(tuan, { Lan: { rec2ar: st(1) } }).map((p) =>
    p.id === "srvLan" ? { ...p, forms: [{ ...p.forms[0], voices: { [H("b")]: "Tuan" } }] } : p));
  u = ask(items, "Lan", "rec2ar");
  assert.equal(u.setKind, "word");
  u = T.castQuestion(items, { id: "srvLan", type: "rec2ar" });
  items = install(pictures(tuan, { Lan: { rec2ar: st(2) } }).map((p) =>
    p.id === "srvLan" ? { ...p, forms: [{ ...p.forms[0], voices: { [H("b")]: "Tuan" } }] } : p));
  assert.equal(T.voiceLineOf(ask(items, "Lan", "rec2ar")), "Recorded by Mai and Tuan");
  /* Minh has no recording and his word none: nothing to play at all. */
  items = install(pictures(ALL_ANSWERED));
  assert.ok(!offered(items, "Minh").some((/** @type {string} */ t) => t.startsWith("rec")));
});

test("hear it, pick the picture never offers one the learner calls by the same word, nor the same name", () => {
  const same = { ...ALL_ANSWERED, Minh: { meaning: "father's younger sister" } };
  const items = install(pictures(same, { Lan: { rec2img: st(1) } }));
  const u = ask(items, "Lan", "rec2img");
  const pool = T.setChoicePool(u, "image").map((/** @type {any} */ f) => f.id);
  assert.ok(!pool.includes("srvMinh"), String(pool));
  assert.ok(!pool.includes("srvLan"));
});

test("a card with three pictures shows them in turn, and the same one again after a miss", () => {
  const at = (/** @type {any} */ s) => ask(install(pictures({}, { Lan: { img2ar: s } })), "Lan", "img2ar").imageAt;
  assert.deepEqual([0, 1, 2, 3].map((n) => at(st(n))), [0, 1, 2, 0]);
  assert.equal(at({ ...st(1), wrong: 4, lapses: 2 }), 1, "a miss does not move it");
  const one = ask(install(pictures({})), "Minh", "img2ar");
  assert.equal(one.imageAt, undefined, "one picture: as before");
});

test("a card with several pictures in no set takes turns too, and is otherwise asked as before", () => {
  const plain = { ...word("dHanoi", "z1", "بيت", "house"), forms: [{ id: "srvz1", ar: "بيت", en: "house", lat: "beet", lang: "ar-PS", images: [H("7"), H("8")], s: { img2ar: st(1) } }] };
  const items = [plain];
  T.installIndexes(items, settings);
  const u = T.castQuestion(items, { id: "srvz1", type: "img2ar" });
  assert.equal(u.imageAt, 1);
  assert.equal(u.ar, "بيت");
  assert.equal(u.setKind, undefined);
});

test("a report about a set's picture carries the answer; any other card's carries nothing", () => {
  install(pictures(ALL_ANSWERED));
  assert.equal(T.setReportLine("srvLan"), "Their answer for لان: \"father's younger sister\" (Hanoi)");
  assert.equal(T.setReportLine("srvw1"), "");
});
