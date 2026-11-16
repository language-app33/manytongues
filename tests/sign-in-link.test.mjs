/* A student's private sign-in link: the space's address, the key after # (0.638). */
import { test } from "node:test";
import assert from "node:assert/strict";
const { signInLink, keyFromHash, keyFromLink } = await import("../src/sign-in-link.ts");

const origin = "https://manytongues.co";
const key = "cedar-harbour-quartz-ember-4f2a";

test("a link carries the key after #, and gives it back", () => {
  const link = signInLink(origin, "lingua", key);
  assert.equal(link, `${origin}/lingua#key=${key}`);
  const url = new URL(link);
  assert.equal(url.pathname, "/lingua");
  assert.equal(url.search, "");
  assert.equal(keyFromHash(url.hash), key);
});

test("an address without a well-shaped key gives nothing", () => {
  for (const hash of ["", "#", "#key=", "#key=one", "#join=abc", "#key=a-b-c&x=1", "#key=cedar harbour-quartz", "#key=cedar-<b>-quartz", "#key=%E0%A4%A"]) {
    assert.equal(keyFromHash(hash), "", hash);
  }
});

test("a pasted link gives its key; anything else gives nothing", () => {
  assert.equal(keyFromLink(signInLink(origin, "lingua", key)), key);
  assert.equal(keyFromLink(`  ${signInLink(origin, "main", key)}  `), key);
  assert.equal(keyFromLink(key), "", "a bare key is typed, not pasted as a link");
  assert.equal(keyFromLink(`${origin}/lingua?join=abc-def-1234`), "", "an invitation is not a sign-in link");
  assert.equal(keyFromLink("just some words"), "");
});
