// @ts-check
/*
 * Can't reach the server, with Retry (0.636).
 *
 * The snackbar is drawn by React, but what it says and what Retry does are
 * decided in reach.ts, without a browser: which failures it takes, that it
 * stays until what failed has worked, that Retry redoes everything
 * waiting, and that "Still can't reach the server" is said only when
 * something is still waiting after a retry.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const {
  isUnreachable,
  holdReach,
  releaseReach,
  retryReach,
  dismissReach,
  showReach,
  reachState,
  resetReach,
} = await import("../src/reach.ts");

beforeEach(() => resetReach());

test("only a server out of reach is taken, not the server's own answer", () => {
  assert.equal(isUnreachable(new Error("offline")), true);
  for (const s of ["502", "503", "504"]) assert.equal(isUnreachable(new Error(`http-${s}`)), true, s);
  assert.equal(isUnreachable("offline"), true);
  for (const m of ["bad-code", "http-500", "http-404", "bad-key", "bad-response", "device-full"]) {
    assert.equal(isUnreachable(new Error(m)), false, m);
  }
  assert.equal(isUnreachable(null), false);
});

test("shown while anything is held, and gone once all of it is let go", () => {
  assert.equal(reachState().shown, false);
  const a = holdReach({ retry: () => {} });
  const b = holdReach({ retry: () => {} });
  assert.equal(reachState().shown, true);
  releaseReach(a);
  assert.equal(reachState().shown, true);
  releaseReach(b);
  assert.equal(reachState().shown, false);
});

test("Retry redoes everything waiting, and says nothing more if it all worked", async () => {
  /** @type {string[]} */
  const done = [];
  /** @type {number[]} */
  const ids = [];
  ids.push(holdReach({ retry: () => { done.push("courses"); releaseReach(ids[0]); } }));
  ids.push(holdReach({ retry: async () => { done.push("join"); releaseReach(ids[1]); } }));
  const going = retryReach();
  assert.equal(reachState().retrying, true);
  await going;
  assert.deepEqual(done.sort(), ["courses", "join"]);
  assert.deepEqual(reachState(), { shown: false, retrying: false, again: false, detail: "" });
});

test("a retry that fails again says so, and keeps Retry", async () => {
  holdReach({ retry: () => Promise.reject(new Error("offline")) });
  assert.equal(reachState().again, false);
  await retryReach();
  const s = reachState();
  assert.equal(s.shown, true);
  assert.equal(s.retrying, false);
  assert.equal(s.again, true);
});

test("the connection coming back leaves alone what is only redone by hand", async () => {
  let left = 0;
  let loaded = 0;
  holdReach({ retry: () => { left += 1; }, auto: false });
  holdReach({ retry: () => { loaded += 1; } });
  await retryReach({ auto: true });
  assert.equal(left, 0);
  assert.equal(loaded, 1);
  await retryReach();
  assert.equal(left, 1);
  assert.equal(loaded, 2);
});

test("closed with its cross, it opens again on the next failure", () => {
  holdReach({ retry: () => {} });
  dismissReach();
  assert.equal(reachState().shown, false);
  showReach();
  assert.equal(reachState().shown, true);
  dismissReach();
  holdReach({ retry: () => {} });
  assert.equal(reachState().shown, true);
});

test("the line under the headline is the newest failure's own", () => {
  holdReach({ retry: () => {} });
  assert.equal(reachState().detail, "");
  holdReach({ retry: () => {}, detail: "Setting up needs a connection." });
  assert.equal(reachState().detail, "Setting up needs a connection.");
});
