# Plan: one acting space for every request (0.582)

A handover plan. Written for whoever builds it, so it names files, functions
and lines; the owner has already agreed the choices (1a, 2a, 3a below) and
does not need to be asked again. Follow `CLAUDE.md` for delivery: `npm run
check` green, release bumped, changelog written, merged to `beta`.

The reproduction is already committed and failing on this branch:
`tests/space-mixup.test.mjs`. When it passes, and the new tests in A6 pass,
the work is done.

## A1. What is wrong, in plain terms

Every request the app sends carries "which space I'm acting in" as the
`x-org` header. The server (`server/api/courses.js`, ~1702–1713) uses that
header when it is present and the caller may act there; when it is absent
it falls back to the caller's own first space. Nothing in that rule needs
to change. The leaks are all on the client:

1. **An App admin at another space's address.** The app learns which space
   an address is by asking the server (`org-info`), which takes a moment.
   Any request sent before that answer leaves with no `x-org` and acts in
   the admin's own first space. `?open=admin` opens Admin immediately on
   load, so Admin's first fetch is such a request. Teaching has the same
   fault. So does *any* action taken in that first moment, including writes.

2. **A member of several spaces.** The acting space is known synchronously
   from the stored account, but the app only hands it to the request layer
   in a parent effect (`src/ArabicTrainer.tsx` ~9719–9722), which runs
   *after* the child screens' mount effects. A screen that fetches on mount
   can go out without it, and the server then picks the member's first
   active space, which may not be the one at the address.

3. **Copies kept on the device are filed per account, not per space.**
   `src/shared.tsx` ~4555–4660: the Admin and Teaching copies (`spaceHeld`,
   `SPACE_KEY`) are keyed by handle only. A copy from space A is shown at
   first paint in space B; worse, once a wrong-space answer has landed in
   the slot, a later "nothing moved" (304) answer makes `pullAdmin` /
   `pullTeaching` hand that copy back, and it sticks until a reload. The
   "teaches" flag (`TEACHES_KEY`, `src/ArabicTrainer.tsx` ~9422–9440) is
   one per device, though it differs per space.

Agreed decisions: **1a** every request waits for the space (two sign-in-time
exemptions); **2a** Admin copy, Teaching copy and teaches flag all keyed by
space; **3a** an answer for a space other than the one now acting is dropped.

What is deliberately *not* changed: Learning reads across all the caller's
spaces by design (`WIDE` on the server; the "All · space" row is a view
filter); switching space always reloads the page; super-admin actions that
act on another space already pass `org` explicitly; ETags are already keyed
by `x-org` (`tagAt` in `call`).

## A2. The design

One function in `src/courses-api.ts` answers "which space am I acting in?"
synchronously where it can, and says "not yet known" where it can't. `call`
consults it for every request and waits when it must. Everything kept on the
device for a space uses the same answer as part of its key.

## B1. `src/courses-api.ts`

Replace the bare `addressOrg` mechanism (lines ~20–30 and 141, plus
`currentOrg` at ~347) with the following. Keep `setAddressOrg` as the
function `ArabicTrainer`'s address lookup calls; keep its name.

```ts
/*
 * The space every request acts in (0.582).
 *
 * Known at once for a member (the space at the address when it is one of
 * theirs, else the one whoami landed them in) and for an App admin at one
 * of their own addresses or at the plain address. Not yet known for an App
 * admin at another space's address, until org-info has said which space
 * that is: a request then WAITS rather than leaving without it, because a
 * request without it acts in the admin's own first space.
 */
let addressOrg = "";            // what the lookup said; "" until it has
let lookupFailed: Error | null = null;
let waiters: { ok: (id: string) => void; no: (e: Error) => void }[] = [];

/* The account as stored, parsed once and kept current by saveAccount /
   clearAccount — call() must not JSON.parse on every request. */
let accountNow: (User & { key: string }) | null = loadAccount();

function slugHere(): string {
  if (typeof window === "undefined" || !window.location) return "";
  return (window.location.pathname.split("/")[1] || "").toLowerCase();
}
function orgsOf(me: any): { id: string; slug: string }[] {
  return Array.isArray(me.orgs) && me.orgs.length ? me.orgs
    : me.org && typeof me.org === "object" ? [me.org] : [];
}

/**
 * The acting space's id; "" when the server should use its own default
 * (nobody signed in, or an admin at the plain address); null when it is
 * not yet known and the request must wait.
 */
export function actingSpace(): string | null {
  if (addressOrg) return addressOrg;
  const me = accountNow;
  if (!me) return "";
  const here = slugHere();
  const own = orgsOf(me).find((o) => o && o.slug === here);
  if (me.admin) return own ? own.id : here ? null : "";
  if (own) return own.id;
  return me.org && typeof me.org === "object" ? me.org.id : "";
}

/** The acting space for keying things kept on the device: "" while unknown. */
export const currentOrg = () => actingSpace() || "";

export function setAddressOrg(id?: string | null) {
  addressOrg = id || "";
  lookupFailed = null;
  if (addressOrg) {
    const w = waiters; waiters = [];
    for (const x of w) x.ok(addressOrg);
  }
}
/** The address lookup failed: every request waiting on it fails too, and
    the next one waits for the next attempt. */
export function spaceLookupFailed(e: Error) {
  lookupFailed = e;
  const w = waiters; waiters = [];
  for (const x of w) x.no(e);
}
function awaitSpace(): Promise<string> {
  if (lookupFailed) {
    const e = lookupFailed; lookupFailed = null;   // one failure fails the calls of one moment
    return Promise.reject(e);
  }
  return new Promise((ok, no) => waiters.push({ ok, no }));
}
```

- `saveAccount` and `clearAccount` set `accountNow` (to the account, or
  null) in addition to what they do now.
- `tryingSpace()` keeps its behaviour; rewrite it on `slugHere`/`orgsOf` so
  the two cannot disagree.
- In `call(...)`: replace the line `if (org || addressOrg) headers["x-org"]
  = org || addressOrg;` with:

```ts
  let space = org || "";
  /* An anonymous call (key === "") is sign-up, sign-in or the address
     lookup itself, which cannot wait for the lookup. */
  if (!space && key !== "") {
    const known = actingSpace();
    space = known === null ? await awaitSpace() : known;
  }
  if (space) headers["x-org"] = space;
```

  `tagAt` must use `headers["x-org"]` as it does now, after this.

- Export nothing else new. `currentOrg` keeps its name because
  `shared.tsx` will use it.

Note on `whoami`: it passes `key` explicitly, not `""`, so it waits like
everything else. That is intended: an admin's whoami at another space's
address should act there.

## B2. `src/ArabicTrainer.tsx`

1. **The address lookup (`look`, ~9640–9668).** On a failure that is not
   `no-space`, call `API.spaceLookupFailed(e)` and retry: `setTimeout(() =>
   look(slug, hops), delay)` with delay 2s, 4s, 8s … capped at 30s, while
   `live`. On `no-space`, call `API.spaceLookupFailed(e)` once and do not
   retry (the unknown-address screen is shown; every request fails with
   that error, which is right). On success, keep calling `setAddressOrg`
   exactly as now — only for `!who || who.admin`.
2. **Remove the member effect** at ~9719–9722 (`if (accountOrgId &&
   !memberAdmin) API.setAddressOrg(accountOrgId)`). `actingSpace()` answers
   that synchronously now. Keep `accountOrg`, `accountOrgId`, `atOwnAddress`
   for the screens that read them.
3. **The teaches flag per space** (~9422–9440 and ~11371–11373).
   `TEACHES_KEY` becomes a function of the space:
   `const teachesKey = () => \`arabic-trainer-teaches:${API.currentOrg()}\``.
   `loadTeaches()` reads that key (an unknown space reads as `false`, which
   is right: an admin sees Teaching regardless). `saveTeaches(yes)` writes
   it. Remove nothing else; `setTeaches(r.teaches)` stays.
4. **Opening into Teaching at launch** (~9771–9777) uses `loadTeaches()` and
   needs no change beyond 3.
5. Add to the sync-now path nothing: `syncEverything` calls `pullTeaching`
   and `pullAdmin`, which go through `call` and therefore wait.

## B3. `src/shared.tsx` — the kept copies, per space (~4555–4660)

- `spaceHeld` entries become `{ handle, org, shown }`.
- `rememberSpace(space, handle, shown)`: read `const org =
  API.currentOrg()`; if `org === ""` **and** `API.actingSpace() === null`
  (still unknown), return without storing — nothing fetched under the gate
  can reach here in that state, so this is only a guard. Store `{ handle,
  org, shown }` in memory and `{ handle, org, shown, at }` on the device.
  `rememberOnDevice`'s comparison text becomes
  `JSON.stringify([handle, org, shown])`.
- `recallFromDevice(space, handle)` returns `held.shown` only when
  `held.handle === handle && (held.org || "") === API.currentOrg()`.
- `recallSpace(space, handle)`: the in-memory copy is returned only when
  both handle and org match; otherwise fall through to the device as now.
- `deliverSpace` passes `org` to watchers; `useFreshSpace` adopts only when
  `which === space && whose === handle && org === API.currentOrg()`.
- **3a, late answers:** in `pullTeaching` and `pullAdmin`, take `const at =
  API.currentOrg()` before the fetch and compare after it. If it differs,
  return what is held for the current space (`recallSpace`) or, when
  nothing is, `{ courses: [], decks: [], cards: [], missingClips: [],
  failed: null }` / the held admin copy, **without** delivering the
  fetched answer. (With B1 in place this cannot fire; it is insurance.)
- The 304 paths already call `recallSpace`, which now answers for the
  current space only. That is what makes `tests/space-mixup.test.mjs` pass.

## B4. `src/spaces.tsx`

No change needed. `TeachSpace` and `AdminSpace` read `recallSpace` and
`useFreshSpace`, whose keying changed underneath them. Check that nothing
there calls `API.setAddressOrg`; it should not.

## B5. Server

No change. Add nothing to `WIDE`.

## A6. Tests

1. `tests/space-mixup.test.mjs` (exists, failing): must pass unchanged.
2. `tests/space-cache.test.mjs` (exists): its `fetch` mock ignores headers
   and no account is stored, so `actingSpace()` answers `""` and the tests
   should pass as they are. If `recallSpace` now needs an org, confirm the
   tests still pass with `""`.
3. New, in `tests/acting-space.test.mjs`, built the same way as
   `space-mixup` (both `shared.tsx` and `courses-api.ts` with
   `splitting: true`, so they share one module instance; stub
   `localStorage` and `window.location` with a settable `pathname`):
   - **A member in two spaces at one of their addresses sends that space
     from the first request.** Store an account `{ handle, key, admin:
     false, org: {id:"main",slug:"main"}, orgs: [{id:"main",slug:"main"},
     {id:"lingua",slug:"lingua"}] }` via `API.saveAccount`, set pathname to
     `/lingua`, call `API.myDecks()` with a `fetch` mock that records
     `init.headers["x-org"]`; assert `"lingua"`. At `/` assert `"main"`.
   - **An App admin at another space's address waits.** Account with
     `admin: true`, orgs `[main]`, pathname `/lingua`. Start
     `API.myDecks()`; after a tick assert `fetch` was not called; call
     `API.setAddressOrg("lingua")`; await; assert the header was
     `"lingua"`.
   - **A failed lookup fails the waiting request and the next one waits
     again.** Same setup; start a call; `API.spaceLookupFailed(new
     Error("offline"))`; assert it rejects with that error; start another
     call; assert it is still pending; `setAddressOrg("lingua")`; assert
     it resolves.
   - **Anonymous calls do not wait.** Same admin setup, `API.orgInfo("x")`
     (key `""`) resolves without `setAddressOrg`.
   - **The teaches flag is per space** can be covered by reading the key
     name in `ArabicTrainer.tsx` with a grep-style assertion if a component
     test is too heavy; a `tests/top-level.test.mjs`-style source check is
     acceptable.
4. `node tests/smoke.mjs` must still pass; it runs the app in jsdom with a
   stored account at the plain address, so `actingSpace()` answers at once.
   If the smoke harness signs in as an App admin at a slug anywhere, make
   sure its `org-info` stub answers, or the gated calls will hang; a hang
   there is a signal that a call was not exempted correctly, not a reason
   to loosen the gate.

## A7. Records

- `package.json` → `0.582.0` (and `package-lock.json`, both occurrences
  near the top).
- `CHANGELOG.md`, new section `## 0.582 — <date>`, in plain terms. For
  teachers and admins: opening a space from Super Admin, or landing at a
  space's address, can no longer show another space's decks, cards or
  people, and can no longer act in another space during the first moment
  after opening; the first visit to a space on a device starts blank rather
  than showing another space's list; Teaching is offered per space.
- `DECISIONS.md`: one entry, "one acting space, decided at the request
  layer": requests wait for the space rather than leaving without it; the
  device keys a space's copies by space; the server's fallback is unchanged
  because the client no longer relies on it.
- `README.md`, "Spaces" section: a bullet under "Addresses and joining"
  saying how a request learns its space (`actingSpace` in
  `src/courses-api.ts`), and that a request waits when it is not yet known.
- `npm run components` if any component's line moved (`src/component-uses.js`
  is checked by a test).

## A8. Order of work

B1 → B2 → B3 → run `tests/space-mixup.test.mjs` (should pass) → A6 new
tests → `npm run check` → A7 → deliver per `CLAUDE.md`.

## A9. Pitfalls

- Do not make `call` wait for anonymous calls (`key === ""`): the address
  lookup is one of them, and waiting on it would deadlock.
- `accountNow` must be refreshed by `saveAccount`/`clearAccount`; the
  sign-in flow saves the account and then immediately makes calls.
- `recallSpace` with an unknown space must return `null`, never another
  space's copy. Blank first paint is the intended cost.
- Keep `SPACE_TRIAL` in `SPACE_KEY`: trying a space still keeps its copies
  apart and drops them on leaving.
- Do not change `WIDE`, `inScope` or the server's fallback.
