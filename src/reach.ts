/*
 * "Can't reach the server", said once, with a way to try again (0.636).
 *
 * The app used to say it in about thirty places, each in its own words and
 * each in its own corner of the screen: under a form, in place of a list,
 * in a pill that faded before it could be acted on. None of them offered
 * anything to do about it except to find the button again and press it.
 *
 * Now every one of those places hands what failed to this module instead,
 * and one large snackbar at the foot of the app says it, with Retry. Retry
 * redoes exactly what failed — reloads that list, resends that join — for
 * every place that is waiting, and so does the connection coming back.
 *
 * Held here rather than in React because the snackbar has to be the same
 * one whichever screen is up, including the sign-in page, which is drawn
 * outside everything else. The React side — the hook that holds a failure
 * while its screen is open, and the snackbar itself — is in shared.tsx.
 */

import { noConnection, watchNet, watchReached } from "./net.ts";

/** Whether a failure is "no connection": see `noConnection` in net.ts,
    which is the rule; this is its name where the bar is concerned. */
export const isUnreachable = (err: unknown): boolean => noConnection(err);

/** One thing that failed, and how to do it again. */
export interface Held {
  retry: () => unknown;
  /** A line under the headline, where the general one is wrong. */
  detail?: string;
  /** The headline itself, where the failure is not the server being out of
      reach: "Sync failed" (0.655). The last one held wins, like detail. */
  title?: string;
  /** False for something that should only be redone when asked: a delete,
      or leaving a space. The connection coming back does not redo it. */
  auto?: boolean;
}

export interface ReachState {
  shown: boolean;
  retrying: boolean;
  /** A retry was made and something is still waiting: "Still can't…". */
  again: boolean;
  detail: string;
  title: string;
}

const held: Map<number, Held> = new Map();
let nextId = 1;
let retrying = false;
let again = false;
/* Closed with its cross. Opens again on the next failure, not on the next
   retry of the old ones, which carry on quietly behind it. */
let dismissed = false;

type Listener = (s: ReachState) => void;
const listeners: Set<Listener> = new Set();

export function reachState(): ReachState {
  const last = [...held.values()].pop();
  return {
    shown: held.size > 0 && !dismissed,
    retrying,
    again: again && held.size > 0,
    detail: (last && last.detail) || "",
    title: (last && last.title) || "",
  };
}

function tell() {
  const s = reachState();
  for (const fn of [...listeners]) {
    try {
      fn(s);
    } catch (e) {
      /* one listener failing must not keep the rest from hearing */
    }
  }
}

/** Hear about the snackbar changing. Returns the way to stop. */
export function watchReach(fn: Listener): () => void {
  wire();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Hold a failure until it is released. Returns its id, for releasing. */
export function holdReach(h: Held): number {
  wire();
  const id = nextId++;
  held.set(id, h);
  dismissed = false;
  tell();
  return id;
}

/** What a held failure says, changed in place: the same thing failed
    again, for a different reason. Not shown again if it was closed. */
export function updateReach(id: number, h: Partial<Held>) {
  const was = held.get(id);
  if (!was) return;
  held.set(id, { ...was, ...h });
  tell();
}

/** A held failure happened again (pressed a second time, say): show it,
    even if the snackbar was closed. */
export function showReach() {
  if (!dismissed) return;
  dismissed = false;
  tell();
}

/** It worked, or its screen closed: no longer waiting. */
export function releaseReach(id: number) {
  if (!held.delete(id)) return;
  if (!held.size) {
    again = false;
    dismissed = false;
  }
  tell();
}

export function dismissReach() {
  dismissed = true;
  tell();
}

/* Long enough for a screen whose retry worked to put that on screen, and
   so let go of its failure, before "Still can't reach the server" could be
   said about it. */
const SETTLE_MS = 120;

/**
 * Do again everything that is waiting. `auto` is the connection coming
 * back, which leaves alone whatever asked to be redone only by hand.
 */
export async function retryReach({ auto = false }: { auto?: boolean } = {}) {
  if (retrying || !held.size) return;
  const tries = [...held.values()].filter((h) => !auto || h.auto !== false);
  if (!tries.length) return;
  retrying = true;
  tell();
  await Promise.allSettled(
    tries.map((h) => {
      try {
        return Promise.resolve(h.retry());
      } catch (e) {
        return Promise.reject(e);
      }
    }),
  );
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  retrying = false;
  again = held.size > 0;
  tell();
}

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  watchNet((offline) => {
    if (!offline) void retryReach({ auto: true });
  });
  /* And when anything else gets through (0.667): the device may have been
     online all along with the server away, which the browser never says.
     At most every half a minute, so a request that keeps failing while
     others succeed cannot turn this into a loop. */
  let last = 0;
  watchReached(() => {
    const t = Date.now();
    if (retrying || !held.size || t - last < 30000) return;
    last = t;
    void retryReach({ auto: true });
  });
}

/** For the tests: forget everything held. */
export function resetReach() {
  held.clear();
  retrying = false;
  again = false;
  dismissed = false;
  tell();
}
