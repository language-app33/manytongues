// @ts-check
/*
 * Personal sets: the pure rules in src/sets.ts, one sentence a test.
 *
 * A personal set is a deck with a `set` field; a student's answer for one
 * of its pictures is a record in that picture's progress. These are the
 * readers that narrow both, and the one function that writes an answer.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const S = await import(path.join(here, "..", "src", "sets.ts"));

test("readSet takes nothing that is not an object, and never throws", () => {
  for (const raw of [null, undefined, "set", 3, true, [], [1, 2]]) {
    assert.equal(S.readSet(raw, "dA"), null);
  }
});

test("readSet fills empty wording with the default and trims the rest", () => {
  const s = S.readSet({ wording: { question: "  Who? ", none: "", askName: 5 } }, "dA");
  assert.equal(s.wording.question, "Who?");
  assert.equal(s.wording.none, S.DEFAULT_WORDING.none);
  assert.equal(s.wording.askName, S.DEFAULT_WORDING.askName);
  assert.equal(s.wording.askWord, S.DEFAULT_WORDING.askWord);
});

test("readSet cuts over-long wording at its limit", () => {
  const s = S.readSet({ wording: { question: "x".repeat(500) } }, "dA");
  assert.equal(s.wording.question.length, S.SET_LIMITS.wording);
});

test("readSet keeps lists that look like deck ids, once each, never its own deck, at most twelve", () => {
  const many = Array.from({ length: 20 }, (_, i) => `d${i}`);
  const s = S.readSet({ lists: ["dA", "dB", "dB", "<b>", 7, ...many] }, "dA");
  assert.equal(s.lists[0], "dB");
  assert.ok(!s.lists.includes("dA"));
  assert.ok(!s.lists.includes("<b>"));
  assert.equal(s.lists.length, S.SET_LIMITS.lists);
  assert.equal(new Set(s.lists).size, s.lists.length);
});

test("readSet keeps at most five hundred ticked words", () => {
  const s = S.readSet({ named: Array.from({ length: 600 }, (_, i) => `k${i}`) }, "dA");
  assert.equal(s.named.length, S.SET_LIMITS.named);
});

test("readSet drops unknown fields, and reads the kinds and the order", () => {
  const s = S.readSet({ extra: 1, asks: { name: false, word: "no" }, order: "after" }, "dA");
  assert.equal("extra" in s, false);
  assert.deepEqual(s.asks, { name: false, word: true, both: true });
  assert.equal(s.order, "after");
  assert.equal(S.readSet({ order: "sideways" }, "dA").order, "before");
});

test("an empty set has the default wording, no lists, every kind on, the word before the name", () => {
  const e = S.emptySet();
  assert.deepEqual(e.wording, S.DEFAULT_WORDING);
  assert.deepEqual(e.lists, []);
  assert.deepEqual(e.named, []);
  assert.deepEqual(e.asks, { name: true, word: true, both: true });
  assert.equal(e.order, "before");
  assert.deepEqual(S.readSet(e, "dA"), e);
});

test("readAnswer takes only a record with a time on it, and drops what it does not know", () => {
  for (const raw of [null, "x", 3, [], {}, { updated: "soon" }, { updated: -1 }]) {
    assert.equal(S.readAnswer(raw), null);
  }
  assert.deepEqual(S.readAnswer({ updated: 5, meaning: " aunt ", none: "yes", skip: true, list: "dB", phase: "new" }), {
    updated: 5,
    meaning: "aunt",
    skip: true,
    list: "dB",
  });
  assert.equal(S.readAnswer({ updated: 5, meaning: "x".repeat(500) }).meaning.length, 200);
});

/** @returns {any} */
const item = () => ({
  id: "i1",
  updated: 1,
  forms: [
    { id: "i1", s: { img2pick: { phase: "review", updated: 1 }, [S.SET_KEY]: { updated: 1, list: "dB", skip: true } } },
    { id: "i1-f1", s: {} },
  ],
});

test("withAnswer keeps the record's other fields, and stamps the record and the item", () => {
  const next = S.withAnswer(item(), { meaning: "aunt", skip: undefined }, 99);
  assert.deepEqual(next.forms[0].s[S.SET_KEY], { updated: 99, list: "dB", meaning: "aunt" });
  assert.equal(next.updated, 99);
});

test("withAnswer leaves every other key of the progress, and every other form, untouched", () => {
  const was = item();
  const next = S.withAnswer(was, { none: true }, 99);
  assert.deepEqual(next.forms[0].s.img2pick, was.forms[0].s.img2pick);
  assert.equal(next.forms[1], was.forms[1]);
  assert.deepEqual(was.forms[0].s[S.SET_KEY], { updated: 1, list: "dB", skip: true }, "and the item it was given");
});

test("withAnswer writes a first answer onto a form with no progress", () => {
  const next = S.withAnswer({ forms: [{ id: "x" }] }, { list: "dC" }, 7);
  assert.deepEqual(next.forms[0].s, { [S.SET_KEY]: { updated: 7, list: "dC" } });
});

/* ------------------------------------------------------------------
   What a student is still to be asked (0.630)
   ------------------------------------------------------------------ */

const HANOI = { id: "dHanoi", title: "Hanoi", words: [{ en: "father's younger sister" }, { en: "grandmother" }, { en: "mother" }] };
const SAIGON = { id: "dSaigon", title: "Saigon", words: [{ en: "Father's younger sister " }, { en: "grandmother" }] };
const config = (lists = ["dHanoi", "dSaigon"]) => ({ ...S.emptySet(), lists });
const ans = (/** @type {any} */ a) => ({ updated: 1, ...a });
/** @param {any[]} lists @param {Record<string, any>} answers */
const view = (lists, answers = {}) => ({
  id: "dFamily",
  title: "Our family",
  set: config(),
  lists,
  pictures: ["Lan", "Minh", "Hoa"].map((id) => ({ id, answer: answers[id] || null })),
});

test("with one list held, that is the list, without asking", () => {
  assert.equal(S.chosenList(config(), ["dHanoi"], []), "dHanoi");
  assert.equal(S.chosenList(config(["dHanoi"]), ["dHanoi", "dSaigon"], []), "dHanoi");
});

test("with none held, there is no list", () => {
  assert.equal(S.chosenList(config(), [], [ans({ list: "dHanoi" })]), null);
});

test("with two held, the list on the most recent answer, if it is still one of them", () => {
  const set = config();
  assert.equal(S.chosenList(set, ["dHanoi", "dSaigon"], []), null);
  assert.equal(S.chosenList(set, ["dHanoi", "dSaigon"], [ans({ list: "dHanoi", updated: 1 }), ans({ list: "dSaigon", updated: 5 }), null]), "dSaigon");
  assert.equal(S.chosenList(set, ["dHanoi", "dSaigon"], [ans({ list: "dGone", updated: 9 })]), null);
  assert.equal(S.chosenList({ ...set, lists: ["dHanoi", "dSaigon", "dHue"] }, ["dHanoi", "dSaigon", "dHue"], [ans({ list: "dHue" })]), "dHue");
});

test("an answer resolves by its English, trimmed and in any case, in whichever list is chosen", () => {
  const a = ans({ meaning: "father's younger sister" });
  assert.equal(S.resolve(HANOI.words, a), HANOI.words[0]);
  assert.equal(S.resolve(SAIGON.words, a), SAIGON.words[0]);
  assert.equal(S.resolve(SAIGON.words, ans({ meaning: "mother" })), null);
  assert.equal(S.resolve(HANOI.words, ans({ skip: true })), null);
  assert.equal(S.resolve(HANOI.words, ans({ none: true, meaning: "mother" })), null);
  assert.equal(S.resolve(HANOI.words, null), null);
});

test("a picture is new, skipped, left out, waiting or answered", () => {
  assert.equal(S.pictureState(null, HANOI.words), "new");
  assert.equal(S.pictureState(ans({ list: "dHanoi" }), HANOI.words), "new", "a list chosen is not an answer");
  assert.equal(S.pictureState(ans({ skip: true }), HANOI.words), "skip");
  assert.equal(S.pictureState(ans({ none: true }), HANOI.words), "none");
  assert.equal(S.pictureState(ans({ meaning: "mother" }), HANOI.words), "ok");
  assert.equal(S.pictureState(ans({ meaning: "mother" }), SAIGON.words), "waiting", "the chosen list has no such word");
  assert.equal(S.pictureState(ans({ meaning: "mother" }), null), "waiting", "no list chosen");
});

test("a fresh student with two lists is asked the list, then every picture", () => {
  assert.deepEqual(S.stepsToAsk([view([HANOI, SAIGON])]), [
    { kind: "list", setId: "dFamily" },
    { kind: "picture", setId: "dFamily", pictureId: "Lan", fresh: true },
    { kind: "picture", setId: "dFamily", pictureId: "Minh", fresh: true },
    { kind: "picture", setId: "dFamily", pictureId: "Hoa", fresh: true },
  ]);
});

test("with one list, nobody is asked to choose", () => {
  const steps = S.stepsToAsk([view([HANOI])]);
  assert.equal(steps.filter((/** @type {any} */ s) => s.kind === "list").length, 0);
  assert.equal(steps.length, 3);
});

test("a set whose lists the student holds none of asks nothing", () => {
  assert.deepEqual(S.stepsToAsk([view([])]), []);
});

test("after answers, only what is left is asked; a skip is asked again, not fresh", () => {
  const steps = S.stepsToAsk([
    view([HANOI, SAIGON], {
      Lan: ans({ list: "dHanoi", meaning: "father's younger sister" }),
      Minh: ans({ list: "dHanoi", none: true }),
      Hoa: ans({ list: "dHanoi", skip: true }),
    }),
  ]);
  assert.deepEqual(steps, [{ kind: "picture", setId: "dFamily", pictureId: "Hoa", fresh: false }]);
});

test("a picture added after the rest were answered is asked, alone", () => {
  const v = view([HANOI], { Lan: ans({ meaning: "mother" }), Minh: ans({ meaning: "grandmother" }) });
  assert.deepEqual(S.stepsToAsk([v]), [{ kind: "picture", setId: "dFamily", pictureId: "Hoa", fresh: true }]);
});

test("when the chosen list loses the word, that picture is waiting and asked again", () => {
  const answers = { Lan: ans({ meaning: "mother" }), Minh: ans({ meaning: "grandmother" }), Hoa: ans({ none: true }) };
  assert.deepEqual(S.stepsToAsk([view([HANOI], answers)]), []);
  const lost = { ...HANOI, words: HANOI.words.filter((w) => w.en !== "mother") };
  assert.deepEqual(S.stepsToAsk([view([lost], answers)]), [{ kind: "picture", setId: "dFamily", pictureId: "Lan", fresh: true }]);
});

test("a reset keeps the answer, stamped with the reset's time, and nothing else", () => {
  const s = { img2pick: { phase: "review", updated: 3 }, [S.SET_KEY]: { updated: 3, meaning: "mother", list: "dHanoi" } };
  assert.deepEqual(S.keptAcrossReset(s, 50), { [S.SET_KEY]: { updated: 50, meaning: "mother", list: "dHanoi" } });
  assert.deepEqual(S.keptAcrossReset({ img2pick: { phase: "review", updated: 3 } }, 50), {});
  assert.deepEqual(S.keptAcrossReset(undefined, 50), {});
});

/* ------------------------------------------------------------------
   Practising a picture (0.631)
   ------------------------------------------------------------------ */

test("a picture takes turns between its name, the word and both, as far as each is on and possible", () => {
  const on = S.emptySet();
  assert.deepEqual(S.kindsFor(on, true, true), ["name", "word", "both"]);
  assert.deepEqual(S.kindsFor(on, true, false), ["name", "word"], "an unticked word is never said with the name");
  assert.deepEqual(S.kindsFor(on, false, true), ["name"], "an answer that does not resolve asks the name alone");
  assert.deepEqual(S.kindsFor({ ...on, asks: { name: false, word: true, both: false } }, true, true), ["word"]);
  assert.deepEqual(S.kindsFor({ ...on, asks: { name: false, word: false, both: false } }, true, true), []);
});

test("the word and the name go side by side in the set's order", () => {
  assert.equal(S.pairText(S.emptySet(), "cô", "Lan"), "cô Lan");
  assert.equal(S.pairText({ ...S.emptySet(), order: "after" }, " cô ", "Lan"), "Lan cô");
});

const A = "a".repeat(64), B = "b".repeat(64), C = "c".repeat(64), D = "d".repeat(64);

test("both together is played in one voice where one person recorded both", () => {
  const word = { clips: [A, B], voices: { [A]: "Mai", [B]: "Tuan" } };
  const name = { clips: [C, D], voices: { [C]: "Tuan", [D]: "Mai" } };
  assert.deepEqual(S.pairClips(S.emptySet(), word, name), { groups: [[A], [D]], voices: ["Mai"] });
  assert.deepEqual(S.pairClips({ ...S.emptySet(), order: "after" }, word, name), { groups: [[D], [A]], voices: ["Mai"] });
});

test("otherwise the first recording of each, naming both voices", () => {
  const word = { recs: [{ id: A }], voices: { [A]: "Mai" } };
  const name = { recs: [{ id: C }], voices: { [C]: "Tuan" } };
  assert.deepEqual(S.pairClips(S.emptySet(), word, name), { groups: [[A], [C]], voices: ["Mai", "Tuan"] });
  assert.deepEqual(S.pairClips(S.emptySet(), { clips: [A] }, { clips: [C] }), { groups: [[A], [C]], voices: [] });
  assert.equal(S.pairClips(S.emptySet(), { clips: [] }, name), null);
  assert.equal(S.pairClips(S.emptySet(), word, {}), null);
});

test("only a change from one meaning to another is a real change", () => {
  const was = { updated: 1, meaning: "aunt" };
  assert.equal(S.isRealChange(was, { updated: 2, meaning: "grandmother" }), true);
  assert.equal(S.isRealChange(was, { updated: 2, meaning: " Aunt" }), false);
  assert.equal(S.isRealChange({ updated: 1, skip: true }, { updated: 2, meaning: "aunt" }), false, "a first answer after a skip");
  assert.equal(S.isRealChange(null, { updated: 2, meaning: "aunt" }), false);
  assert.equal(S.isRealChange(was, { updated: 2, none: true }), false, "doesn't apply starts nothing again");
  assert.equal(S.isRealChange({ updated: 1, none: true }, { updated: 2, meaning: "aunt" }), false);
});

test("a report's line says the answer, the doesn't-apply wording, or that there is none", () => {
  const set = { ...S.emptySet(), wording: { ...S.DEFAULT_WORDING, none: "Not mine" } };
  assert.equal(S.answerLine(set, "Lan", { updated: 1, meaning: "aunt" }, "Hanoi"), 'Their answer for Lan: "aunt" (Hanoi)');
  assert.equal(S.answerLine(set, "Lan", { updated: 1, none: true }, ""), 'Their answer for Lan: "Not mine"');
  assert.equal(S.answerLine(set, "Lan", null, "Hanoi"), "Their answer for Lan: not answered yet (Hanoi)");
  assert.ok(S.answerLine(set, "x".repeat(300), null, "").length <= 200);
});

/* ------------------------------------------------------------------
   What the teacher is told (0.632)
   ------------------------------------------------------------------ */

const words = (/** @type {string[]} */ ens) => ens.map((en) => ({ en }));

test("a set with no list says so", () => {
  assert.match(S.setGaps(S.emptySet(), []).join(" "), /No deck of words is chosen yet/);
});

test("a list with fewer than four words says so", () => {
  const set = { ...S.emptySet(), lists: ["dA"] };
  assert.match(S.setGaps(set, [{ title: "Hanoi", words: words(["aunt", "uncle"]) }]).join(" "), /Hanoi has only 2 words/);
  assert.deepEqual(S.setGaps(set, [{ title: "Hanoi", words: words(["a", "b", "c", "d"]) }]), []);
});

test("a meaning one list has and another lacks says so, naming both", () => {
  const set = { ...S.emptySet(), lists: ["dA", "dB"] };
  const gaps = S.setGaps(set, [
    { title: "Hanoi", words: words(["aunt", "uncle", "mother", "father"]) },
    { title: "Saigon", words: words(["Aunt ", "uncle", "mother", "grandfather"]) },
  ]);
  assert.ok(gaps.includes('Hanoi has a word for "father" and Saigon doesn\'t. A student on Saigon who chose it is asked again.'), gaps.join(" | "));
  assert.ok(gaps.some((/** @type {string} */ g) => /Saigon has a word for "grandfather"/.test(g)));
  assert.ok(!gaps.some((/** @type {string} */ g) => /"aunt"/i.test(g)), "the same meaning in any case is the same");
});

test("cards in the deck with no picture say they are not part of the set", () => {
  const set = { ...S.emptySet(), lists: ["dA"] };
  const four = [{ title: "Hanoi", words: words(["a", "b", "c", "d"]) }];
  assert.deepEqual(S.setGaps(set, four, [{ picture: true }, { picture: false }]), ["1 card in this deck has no picture, so it is not part of the set."]);
});

test("the deck check counts a set's pictures and its lists' words without a recording, as on any deck", async () => {
  const { deckQuality } = await import(path.join(here, "..", "src", "deck-quality.ts"));
  const { LANGUAGES } = await import(path.join(here, "..", "src", "languages.ts"));
  const ar = LANGUAGES["ar-PS"];
  const recordings = (/** @type {any} */ q) => q.checks.find((/** @type {any} */ c) => c.key === "recordings");
  const pictures = [
    { id: "p1", lang: "ar-PS", category: "person", forms: [{ ar: "لان", en: "", images: ["i1"], clips: ["c1"] }] },
    { id: "p2", lang: "ar-PS", category: "person", forms: [{ ar: "مين", en: "", images: ["i2"] }] },
  ];
  const list = [
    { id: "w1", lang: "ar-PS", category: "noun", forms: [{ ar: "عمة", en: "aunt", lat: "amma", clips: ["c2"] }] },
    { id: "w2", lang: "ar-PS", category: "noun", forms: [{ ar: "جدة", en: "grandmother", lat: "jidda" }] },
  ];
  const ofList = recordings(deckQuality(list, { lang: ar, pool: list }));
  assert.equal(ofList.share, 0.5, "half the list's words are recorded");
  const ofSet = deckQuality(pictures, { lang: ar, pool: pictures });
  assert.deepEqual(ofSet, deckQuality(pictures.map((p) => ({ ...p })), { lang: ar, pool: pictures }), "a set is scored on its cards, as any deck");
});
