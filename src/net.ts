/*
 * Whether there is a connection, as the app should read it.
 *
 * The app is offline-first, so being offline is an ordinary state and not
 * an error — but nothing said which one the app was in. Every failure
 * looked the same: the dot in the corner turned red, and the line beside
 * it said "Offline — will retry" whether the network was gone, the
 * passphrase was refused, or the document was too big to send. Meanwhile
 * the polls went on firing into the void every forty-five seconds.
 *
 * So the state is held here, in one place, for the two kinds of reader it
 * has: a plain function for the module-level helpers that decide what a
 * session may ask, and a subscription for the components that show it.
 *
 * `navigator.onLine` is the browser's own answer and it is famously
 * generous — a laptop on a wifi network with no route to the internet
 * reads as online. That is why it is only ever used to say *offline* with
 * confidence, never to promise that a request will succeed. False here
 * means "do not bother"; true means "worth trying", which is the most any
 * caller needs.
 */

/** What the app says, in one set of words everywhere, about work it kept
    on this device because it could not be sent yet (0.668). */
export const SAVED_FOR_LATER = "Saved on this device. It will be sent when you're back online.";

/**
 * Whether a failure means "no connection", the one rule the whole app uses
 * for it (0.668).
 *
 * From the person's side these are all the same thing, and trying again
 * later is the fix for every one of them: a request that could not be made
 * or timed out (the client calls both `offline`), a gateway answering for
 * a server that is restarting (502, 503, 504), and an answer the app cannot
 * read — most often a wifi login page standing in for the real one. The
 * sync's own requests name a gateway's answer `pull-failed-502` and the
 * like, and a fetch that never went is a TypeError, so both are read here
 * too. Anything else is an answer in the app's own words, and asking again
 * would be told the same.
 */
export function noConnection(err: unknown): boolean {
  /* Only a fetch's own TypeError — "Failed to fetch" (Chrome), "NetworkError
     when attempting to fetch resource" (Firefox), "Load failed" (Safari).
     Any other TypeError is a bug in the app, and saying "No connection"
     for it would hide the bug behind a Retry that can never work. */
  if (err instanceof TypeError) return /fetch|network|load failed/i.test(err.message);
  const m = String(
    (err && typeof err === "object" && "message" in err && (err as Error).message) || err,
  );
  return m === "offline" || m === "bad-response" || /(^http-|-)50[234]$/.test(m);
}

/*
 * Something got through (0.668). Told by the app's requests whenever one
 * is answered, so work that waited for the connection can go the moment
 * there is one — including when the device was online all along and it
 * was the server that was away, which the browser never announces.
 */
const reachedWatchers: Set<() => void> = new Set();
export function noteReached() {
  for (const fn of [...reachedWatchers]) {
    try {
      fn();
    } catch (e) {
      /* one listener failing must not keep the rest from hearing */
    }
  }
}
export function watchReached(fn: () => void): () => void {
  reachedWatchers.add(fn);
  return () => {
    reachedWatchers.delete(fn);
  };
}

/** True only when the browser is sure there is no connection. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

type Listener = (offline: boolean) => void;

/*
 * Told once, here, rather than by every component adding its own pair of
 * listeners. The set is module-level because the events are: there is one
 * connection and one browser saying so.
 */
const listeners: Set<Listener> = new Set();
let wired = false;

function announce() {
  const off = isOffline();
  for (const fn of [...listeners]) {
    try {
      fn(off);
    } catch (e) {
      /* One subscriber throwing must not stop the rest hearing about it. */
    }
  }
}

function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("online", announce);
  window.addEventListener("offline", announce);
}

/**
 * Hear about the connection coming and going.
 *
 * @returns the way to stop hearing about it, so a component that
 *          subscribes on mount can drop it on unmount.
 */
export function watchNet(fn: Listener): () => void {
  wire();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
