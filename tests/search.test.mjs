/*
 * What a search box finds a card by: any of its forms, not only the first.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { cardMatches } from "../src/search.ts";

const card = {
  id: "c1",
  tags: ["Animals"],
  forms: [
    { id: "f1", ar: "كلب", lat: "kalb", en: "dog" },
    { id: "f2", ar: "كلاب", lat: "klaab", en: "dogs" },
    { id: "f3", ar: "بكتب", lat: "biktib", en: "I write", row: "present", col: "I" },
  ],
};

test("a card is found under any of its forms, in script, pronunciation or meaning", () => {
  for (const q of ["كلب", "kalb", "dog", "كلاب", "klaab", "dogs", "بكتب", "biktib", "I WRITE"]) {
    assert.ok(cardMatches(card, q), q);
  }
});

test("a card written in the old shape is found under its alternates too", () => {
  const old = { id: "c2", ar: "بيت", lat: "beet", en: "house", tags: [], subs: [{ id: "s", ar: "بيوت", lat: "buyuut", en: "houses" }] };
  assert.ok(cardMatches(old, "buyuut"));
  assert.ok(cardMatches(old, "بيوت"));
});

test("name, tags and a conversation's turns are searched; nothing else is", () => {
  assert.ok(cardMatches({ ...card, name: "to write" }, "to write"));
  assert.ok(cardMatches(card, "animal"));
  const scene = { id: "d", tags: [], forms: [], lines: [{ ar: "مرحبا", lat: "marhaba", en: "hello" }] };
  assert.ok(cardMatches(scene, "marhaba"));
  assert.ok(!cardMatches(card, "cat"));
  assert.ok(cardMatches(card, "  "));
  assert.ok(!cardMatches(null, "dog"));
});
