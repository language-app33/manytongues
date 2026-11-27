/*
 * A word's description, in the language itself (0.694): the editor's
 * rules, the two questions asked from it, and what reaches a student's
 * device. See src/description.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildOnce } from "./helpers.mjs";
import { DESC_TYPES, descriptionAsked, givenAway, storedDescription, takesDescription } from "../src/description.ts";
import { canAsk, offersFor } from "../src/offers.ts";
import { EX, LANGUAGES, TYPES, levelOf } from "../src/languages.ts";
import { allowedBy } from "../src/course-practice.ts";
import { skillOf } from "../src/word-skills.ts";

const ar = LANGUAGES["ar-PS"];
const vi = LANGUAGES["vi"];

const built = await buildOnce(["shared.tsx"]);
const { cardToItem, localIdFor } = await import(path.join(built, "shared.js"));
const builtEditor = await buildOnce(["card-editor.tsx"]);
const { initialForms } = await import(path.join(builtEditor, "card-editor.js"));

/** @returns {any} */
const form = (/** @type {Record<string, any>} */ over = {}) => ({
  id: "w1", ar: "مخبز", en: "bakery", lat: "makhbaz", recs: [], s: {}, ...over,
});
const DESC = "محل بنشتري منه خبز";

test("the two questions: the word chosen, then written, from its description", () => {
  assert.deepEqual(DESC_TYPES, ["def2pick", "def2ar"]);
  for (const t of DESC_TYPES) assert.ok(TYPES.includes(t), `${t} is offered`);
  assert.equal(levelOf("def2pick"), 2, "chosen: which word it is");
  assert.equal(levelOf("def2ar"), 4, "written: from its meaning");
  assert.equal(EX.def2pick.answerMode, "choice");
  assert.equal(EX.def2pick.picks, "word");
  assert.equal(EX.def2ar.answerField, "ar");
  /* Its English is behind the nudge and costs nothing: it is the
     description said again, not the word. */
  for (const t of DESC_TYPES) {
    assert.equal(EX[t].hintField, "descEn");
    assert.ok(!EX[t].hintTells, `${t}: the English does not give the word away`);
  }
  /* Where the skills map already put them. */
  assert.equal(skillOf("def2pick")?.skill, "WM");
  assert.equal(skillOf("def2ar")?.meaning, "language");
});

test("asked only of a form with a description, and chosen only with company", () => {
  const on = (/** @type {any} */ unit, mates = 5) => ({ unit, scene: null, contexts: [], mates });
  assert.equal(canAsk(on(form({ desc: DESC })), "def2pick", ar), true);
  assert.equal(canAsk(on(form({ desc: DESC })), "def2ar", ar), true);
  assert.equal(canAsk(on(form()), "def2pick", ar), false, "no description");
  assert.equal(canAsk(on(form()), "def2ar", ar), false);
  assert.equal(canAsk(on(form({ desc: DESC }), 0), "def2pick", ar), false, "nothing to choose between");
  assert.equal(canAsk(on(form({ desc: DESC }), 0), "def2ar", ar), true, "writing needs no company");
  assert.equal(canAsk(on(form({ desc: "chỗ mua bánh mì", ar: "tiệm bánh" })), "def2ar", vi), true, "in every language");

  const list = offersFor({ units: [{ unit: form(), isSub: false, scene: null }], lang: ar, matesFor: () => 5 });
  const waiting = list.find((o) => o.type === "def2ar");
  assert.ok(waiting && !waiting.ready);
  assert.deepEqual(waiting.missing, ["a description in the language itself"], "says what it waits for");
});

test("a description is asked on a word or phrase with one form, and kept on the rest", () => {
  const one = { forms: [{ ar: "مخبز", en: "bakery", desc: DESC }] };
  assert.equal(descriptionAsked(one), true);
  assert.equal(descriptionAsked({ forms: [{ ar: "مخبز", en: "bakery" }] }), false, "none written");
  assert.equal(descriptionAsked({ forms: [{ ar: "مخبز", en: "bakery", desc: "   " }] }), false, "blank");
  assert.equal(descriptionAsked({ forms: [one.forms[0], { ar: "مخابز", en: "bakeries" }] }), false, "a second form");
  assert.equal(descriptionAsked({ ...one, sentence: true }), false, "a sentence");
  assert.equal(descriptionAsked({ ...one, lines: [{}] }), false, "a scene");
  assert.equal(takesDescription({ forms: [] }), true);
  assert.equal(takesDescription({ sentence: true }), false);
});

test("the editor warns where the description uses the word itself", () => {
  assert.equal(givenAway({ ar: "خبز", desc: DESC }, ar), "خبز", "the word in it");
  assert.equal(givenAway({ ar: "خُبز", desc: DESC }, ar), "خُبز", "marks or none, the same word");
  assert.equal(givenAway({ ar: "بيت", desc: "انا بالبيت" }, ar), "بيت", "with ال and a preposition glued on");
  assert.equal(givenAway({ ar: "مخبز", desc: DESC }, ar), "", "a word it does not use");
  assert.equal(givenAway({ ar: "مخبز" }, ar), "", "no description");
  assert.equal(givenAway({ ar: "bánh", desc: "chỗ mua bánh mì" }, vi), "bánh");
});

test("stored trimmed and capped, and its English only beside a description", () => {
  assert.deepEqual(storedDescription({ desc: `  ${DESC} `, descEn: " where we buy bread " }), { desc: DESC, descEn: "where we buy bread" });
  assert.deepEqual(storedDescription({ descEn: "alone" }), {}, "English without a description");
  assert.deepEqual(storedDescription({}), {});
  assert.equal(String(storedDescription({ desc: "ب".repeat(500) }).desc).length, 240);
});

test("a student's device gets the description on a one-form word, and not otherwise", () => {
  const card = (/** @type {any} */ over) => ({ id: "c1", lang: "ar-PS", ...over });
  const lead = (/** @type {any} */ item) => item.forms.find((/** @type {any} */ f) => f.id === localIdFor("c1"));
  const one = cardToItem(card({ forms: [{ ar: "مخبز", en: "bakery", lat: "makhbaz", desc: DESC, descEn: "where we buy bread" }] }), "", "", "", () => ({}));
  assert.equal(lead(one).desc, DESC);
  assert.equal(lead(one).descEn, "where we buy bread");
  const two = cardToItem(card({ forms: [{ ar: "مخبز", en: "bakery", desc: DESC }, { id: "p", ar: "مخابز", en: "bakeries" }] }), "", "", "", () => ({}));
  assert.equal(lead(two).desc, undefined, "a card with a second form is not asked it");
  const none = cardToItem(card({ forms: [{ ar: "مخبز", en: "bakery" }] }), "", "", "", () => ({}));
  assert.equal("desc" in lead(none), false, "a form with none gains nothing");
});

test("a description teaches a word in a course with no translation", () => {
  const supported = ["ar2pick", "ar2en", "match", "en2pick", "en2ar", ...DESC_TYPES];
  assert.deepEqual(allowedBy({ mode: "none", off: [] }, supported), DESC_TYPES, "the description's questions stand alone");
  assert.deepEqual(allowedBy({ mode: "none", off: [] }, ["ar2pick", "en2ar"]), [], "without it, nothing");
});

/* Found by running the editor: a saved description did not come back
   when the card was opened again, so the next save would have dropped it. */
test("the editor opens a card with its description, so a save keeps it", () => {
  const [lead] = initialForms(/** @type {any} */ ({ id: "k", lang: "ar-PS", forms: [{ ar: "بيت", en: "house", desc: DESC, descEn: "where we live" }] }), null);
  assert.equal(lead.desc, DESC);
  assert.equal(lead.descEn, "where we live");
  const [plain] = initialForms(/** @type {any} */ ({ id: "k", lang: "ar-PS", forms: [{ ar: "بيت", en: "house" }] }), null);
  assert.equal("desc" in plain, false, "nothing added to a card without one");
});
