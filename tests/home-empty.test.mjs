// @ts-check
/*
 * The home screen is empty when the space on screen has nothing to
 * practise, and says why in one line (0.639). See src/home-empty.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";

const here = path.dirname(new URL(import.meta.url).pathname);
const { whyHomeIsEmpty, homeEmptySays } = await import(path.join(here, "..", "src", "home-empty.ts"));
const { cardsOfSaved } = await import(path.join(here, "..", "src", "saved-sessions.ts"));

test("anything to practise here, and the home screen is not empty", () => {
  assert.equal(whyHomeIsEmpty({ practisable: 3, offLangs: [], cardsHere: 3, coursesHere: 1 }), null);
  /* Even with a language off: what is left on is enough. */
  assert.equal(whyHomeIsEmpty({ practisable: 1, offLangs: ["ar-PS"], cardsHere: 9, coursesHere: 2 }), null);
});

test("a space with no cards and no course here invites a join, counted in this space", () => {
  assert.deepEqual(whyHomeIsEmpty({ practisable: 0, offLangs: [], cardsHere: 0, coursesHere: 0 }),
    { kind: "no-cards", courses: 0 });
});

test("a space whose courses hold nothing yet says it is waiting on them", () => {
  const why = whyHomeIsEmpty({ practisable: 0, offLangs: [], cardsHere: 0, coursesHere: 2 });
  assert.deepEqual(why, { kind: "no-cards", courses: 2 });
  assert.equal(homeEmptySays(why), "Nothing to practice yet!");
});

test("someone in no course is asked to join one", () => {
  assert.equal(homeEmptySays({ kind: "no-cards", courses: 0 }), "Join a course to get started!");
});

test("cards here that cannot be practised yet are not ready, not missing", () => {
  const why = whyHomeIsEmpty({ practisable: 0, offLangs: [], cardsHere: 12, coursesHere: 1 });
  assert.deepEqual(why, { kind: "not-ready" });
  assert.equal(homeEmptySays(why), "Nothing to practice yet!");
  /* Not the teacher's warning it replaces. */
  assert.doesNotMatch(homeEmptySays(why), /exercise type/);
});

test("languages switched off come first: they are one tap away", () => {
  const why = whyHomeIsEmpty({ practisable: 0, offLangs: ["ar-PS", "fr"], cardsHere: 12, coursesHere: 1 });
  assert.deepEqual(why, { kind: "langs", langs: ["ar-PS", "fr"] });
  assert.equal(homeEmptySays(why, 1),
    "Nothing to practice in the selected language. Switch on a language to get started.");
  assert.equal(homeEmptySays(why, 2),
    "Nothing to practice in the selected languages. Switch on a language to get started.");
});

test("a saved session is offered only where it has something to practise", () => {
  const here = [{ id: "a", tags: ["Greetings"] }];
  /* Saved in another space: its cards are not among this space's. */
  assert.equal(cardsOfSaved({ ids: ["x", "y"], decks: ["Verbs"], everything: false }, here).length, 0);
  assert.equal(cardsOfSaved({ ids: [], decks: ["Greetings"], everything: false }, here).length, 1);
  /* "Everything" is only as alive as what can be practised here. */
  assert.equal(cardsOfSaved({ ids: [], decks: [], everything: true }, []).length, 0);
});

test("the home screen reads the space on screen, not the whole device", () => {
  const src = readFileSync(path.join(here, "..", "src", "ArabicTrainer.tsx"), "utf8");
  assert.match(src, /\{homeEmpty && !session && \(/, "the empty screen is decided by homeEmpty");
  assert.match(src, /\{!homeEmpty && !session && \(/, "and the buttons only when there is something");
  assert.doesNotMatch(src, /\{items\.length === 0 && \(\s*\/\* The same component/,
    "not by whether the device holds any card anywhere");
  assert.doesNotMatch(src, /two usable exercise types/, "the teacher's warning is gone from the learner's home");
  assert.match(src, /savedHere\.length > 0 && \(/, "saved sessions are the ones that run here");
  assert.doesNotMatch(src, /label\} · \$\{plural\(picked\.size, "card"\)\}/, "a suggested name carries no count");
});
