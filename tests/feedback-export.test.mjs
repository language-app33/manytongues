/*
 * Copying feedback about the app out of Super admin's Reports (0.646):
 * one block per message, newest first as handed over, with who, which
 * space, which screen, when, and what they said.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const { feedbackToText } = await import("../src/flag-export.ts");

const names = {
  kind: (/** @type {string} */ k) => (k === "broken" ? "Something's broken" : "An idea"),
  space: (/** @type {string} */ id) => (id === "o1" ? "Riverside School" : ""),
  when: (/** @type {number} */ at) => `T${at}`,
};

test("each message reads as a block with who, where, when and what was said", () => {
  const text = feedbackToText(
    [
      { id: "a", kind: "broken", note: "The audio stops.\nEvery time.", handle: "sam", handleName: "Sam", org: "o1", screen: "Practice", release: "0.640", at: 2 },
      { id: "b", kind: "idea", note: "", handle: "kim", handleName: "kim", org: "gone", screen: "", at: 1 },
    ],
    { at: 9, release: "0.646", names },
  );
  assert.match(text, /^Feedback about the app — 2 messages, newest first\.\nExported T9 from app 0\.646\./);
  assert.match(text, /#1 of 2 — Something's broken\nFrom: +Sam \(@sam\)\nSpace: +Riverside School \(o1\)\nScreen: +Practice\nSent: +T2 \(app 0\.640\)\nSaid:\n {2}The audio stops\.\n {2}Every time\./);
  /* A space with no name and no screen leave their lines out; a name the
     same as the handle is not said twice; nothing written says so. */
  assert.match(text, /#2 of 2 — An idea\nFrom: +kim\nSent: +T1\nSaid: +\(nothing written\)\n$/);
});

test("who they are, their courses, what they were doing and the device", () => {
  const text = feedbackToText(
    [
      {
        id: "a", kind: "broken", note: "Wrong.", handle: "sam", handleName: "Sam", org: "o1", screen: "Riverside · practice session", at: 2,
        role: "Learner", spaceName: "Riverside",
        courses: [
          { id: "c1", title: "Beginners Arabic", language: "ar-PS", roles: ["student"] },
          { id: "c2", title: "Hebrew", language: "he-IL", roles: ["teacher", "student"] },
        ],
        context: {
          courseId: "c1", courseTitle: "Beginners Arabic", deckId: "d1", deckTitle: "Family", cardId: "k1",
          exercise: "ar2en", language: "ar-PS", question: "أخت", langsOff: "fr-FR",
          screenSize: "390×844", installed: "yes", online: "no", locale: "en-GB",
        },
        device: "Mozilla/5.0 (iPhone)",
      },
    ],
    { at: 9, names },
  );
  assert.match(text, /From: +Sam \(@sam\)\nRole: +Learner\nSpace: +Riverside School \(o1\)\n/);
  assert.match(text, /Courses: +Beginners Arabic \[ar-PS\] as student \(c1\)\n {10}Hebrew \[he-IL\] as teacher and student \(c2\)\n/);
  assert.match(text, /Doing: +practising "أخت" in ar2en \[ar-PS\]\nSource: +course Beginners Arabic \(c1\), deck Family \(d1\)\nCard: +k1\n/);
  assert.match(text, /Switched off: fr-FR\n/);
  assert.match(text, /Device: +screen 390×844, installed app, offline, language en-GB — Mozilla\/5\.0 \(iPhone\)\n/);
  /* Feedback from before any of this was kept says nothing about it,
     rather than "no courses". */
  const old = feedbackToText([{ id: "b", kind: "idea", note: "x", handle: "a", handleName: "A", org: "o1", screen: "", at: 1 }], { at: 1, names });
  assert.doesNotMatch(old, /Courses:|Role:|Device:/);
});

test("one message, and none", () => {
  assert.match(feedbackToText([{ id: "a", kind: "idea", note: "x", handle: "a", handleName: "A", org: "o1", screen: "", at: 1 }], { at: 1, names }), /1 message,/);
  assert.match(feedbackToText([], { at: 1, names }), /No feedback has been sent\.\n$/);
});
