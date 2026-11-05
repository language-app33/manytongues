# Plan: one account, several spaces

**Status: built, in 0.573** (all three stages in one release). Written from the owner's answers to the
questions in the conversation of 4–5 November 2026 and a reading of the
repository at 0.563. No questions are open. Anything new that comes up
while building goes back to the owner, in the way `CLAUDE.md` describes,
before it is decided.

Part A is for the owner, in plain terms. Part B holds the build notes for
whoever implements it, and is written for a model less capable than the
one that wrote it: it names files, functions and the exact places to
change. It follows `docs/PLAN-spaces.md`, which built the spaces this plan
loosens, and uses its words (`org` for a space in code, App admin, space
admin, acting org).

---

# Part A — for the owner

## A1. What this is

Today an account belongs to exactly one space. Someone in two spaces has
two accounts, two keys, and signs out and in to switch; their practice is
in two separate histories.

After this, **one account can belong to several spaces**, and **Learning
shows everything from all of them**, with a way to narrow to one space
when wanted. Nothing else about spaces changes: each space still has its
own address, people, material and admins, the server still refuses
anything that crosses from one space into another, and Teaching and Admin
are still about one space at a time.

The change is deliberately small. A person in one space, which is nearly
everyone today, sees no difference at all.

## A2. The decisions

**Belonging to several spaces**

- **Joining a second space is the same gesture as joining the first:**
  open its invitation link, or type a course code. Signed in, the screen
  that today says "This link is for {space}… make a new account" instead
  says "Join {space}?" with a Join button. A course code from another
  space, typed into Learning's course-code box, joins that course and its
  space in one step, instead of being refused.
- **You can add an existing person to a space.** In Super admin → People,
  each person has "Add to a space", offering the spaces they're not in.
  No key changes hands: their own key now opens that space too. Someone
  who had left or been removed from that space is put back as a
  reactivation. Space admins can't do this; for them, the invitation link
  and course codes are the way in.
- **The address still means the space you're in.** When you're in several,
  the You menu lists them under the space's name and logo; tapping one
  takes you to that space's address. Teaching and Admin are of the space
  whose address is open, exactly as today.
- **Signing in at a space you're not in** no longer stops you: you land in
  your own space. At the plain address, manytongues.co, you land in the
  space you were last in on that device.
- **Teachers too.** Any account can be in several spaces. A teacher in two
  sees Teaching for whichever space's address is open. Their My space and
  their numbers stay per space, as today.
- **Leaving, and being removed, are per space.** That space's courses go
  out of your Learning, your name comes off its rosters, and you appear
  under its Former members. Your account, and your other spaces, are
  untouched. Settings shows one Leave line per space you're in. Someone
  who leaves, or is removed from, every space is in the position a
  suspended account is in today, and can get back in with an invitation
  link or a course code (someone *removed* from a space can't rejoin it by
  themselves; its admin reactivates them, as today).
- **A closed space hides its courses** from your Learning until it
  reopens, instead of locking the whole account. Only if every space
  you're in is closed are you locked out, as today.
- **Deleting an account** removes it from every space, each keeping what
  was made for it under the person's name and writing a Former members
  record, as today for one space. A space admin's "delete" of someone who
  is also in another space removes them from that space only; only you can
  delete such an account outright.
- **Lost keys.** One key opens every space the person is in. So a space
  admin can give a new key only to someone who is in their space alone;
  for anyone in more than one space, only you can, from Super admin. The
  space admin is told why when they try.
- **What a space's admin sees about a person** is that space's facts.
  "Last practised" and "Last changed material" are counted per space, so
  an admin of Lingua doesn't learn that someone practised in Main
  yesterday. "Last seen" (signing in) stays one date for the account. In
  Super admin, you see the account-wide dates. Until someone practises
  after this ships, a space's admin sees the date they saw before.
- **People who already have two accounts keep both.** Nothing is merged.
  Each key still works, each in its own space.

**Learning across spaces**

- Home, Progress and Cards show everything from every space, and one
  daily session draws from all of it.
- When you're in more than one space, one row of choices appears at the
  top of Learning: **All · Lingua · Main**. It narrows all of Learning at
  once (Home's count and session, Progress, Cards, Courses), it is
  remembered on the device, and it starts on All. In one space nothing
  appears.
- A session started while a space is chosen draws only from that space,
  like the screen it was started from. "What you see is what you
  practise."
- Under All, the Courses page sits courses under a heading per space.
  Progress's deck tiles say their space, and two decks with the same name
  in two spaces are two tiles, each saying its space.

## A3. What each kind of person will see

- **A learner in one space:** nothing new.
- **A learner who follows a second space's invitation, or types one of
  its course codes:** a "Join {space}?" screen, or the course simply
  appearing under a heading with the space's name. From then on the
  All · … row at the top of Learning, and the second space in the You
  menu.
- **A teacher in two spaces:** the You menu lists both; Teaching is of the
  one whose address is open.
- **A space admin:** People shows the same rows; "Last practised" counts
  only their space; a new key for someone in two spaces is refused with a
  sentence saying to ask you.
- **You:** Super admin → People lists a person under every space they are
  in, with their account-wide dates, and "Add to a space" on each.

## A4. Stages

Each stage is a release that can ship on its own, checked with the full
test suite plus new tests, then by hand on the deployed app.

1. **Memberships underneath.** The server lets an account belong to
   several spaces, and everything that was per account becomes per space
   (suspension, Former members, last practised, the key rule). A course
   code from another space joins it; signing in at a space you're not in
   lands you in your own. On screen, almost nothing changes yet: a learner
   who joins a second course this way sees it listed with their others.
2. **Joining and moving around.** "Join {space}?" on another space's
   invitation, the list of your spaces in the You menu, one Leave line per
   space in Settings, landing in the space you were last in, and "Add to
   a space" in Super admin → People.
3. **Learning across spaces.** Headings per space, the All · … row, the
   session that follows it, and "Last practised" per space in Admin.

## A5. Costs and trade-offs accepted

- A person's practice history is one document, as it has always been: the
  cards of every space they are in sit together on their device. Nothing
  on the server reads it, and no space sees another's cards through it.
- Switching space in the You menu reloads the page. Nothing is lost; it is
  the simplest way to make every screen agree about where you are.
- A space admin who tries to issue a key to someone in two spaces learns
  that the person is in more than one space. They don't learn which.
- "Last practised" per space starts counting when this ships; older dates
  are account-wide.
- Someone removed from every space they were in sees today's "suspended"
  message. The wording gains a line about invitation links.

## A6. Open questions

None.

---

# Part B — Build notes (technical, for the implementer)

**How to use Part B.** B1–B4 describe the whole design by subject (data,
the server rule, each action, the client). **B6 says which items belong
to which stage.** Build one stage at a time, from B6's checklist, and
don't start an item that B6 puts in a later stage. B5 is the list of
pitfalls; read it before each stage.

## B0. Ground rules

- Read `CLAUDE.md`, then `docs/PLAN-spaces.md` sections B0–B3 (the ground
  rules, practical notes and the one rule on the server still hold), then
  the "Spaces" section of `README.md`. Follow the repository's delivery
  rules: each stage is a release (bump `package.json`, write a
  `CHANGELOG.md` entry in the README's plain terms, add a `DECISIONS.md`
  entry for each choice made), `npm run check` must be green on the exact
  tree pushed, and push to `beta` as `CLAUDE.md` describes. Update the
  "Spaces" section of `README.md` with a "Memberships (since <stage 1's
  release>)" paragraph in the style of the paragraphs already there.
- **Only existing UI components.** Read `docs/UI-COMPONENTS.md` and run
  `npm run components`. Everything here uses pieces that exist:
  `Segmented`, `Section`, `Tile`, `Button`, `IconButton`, `ConfirmModal`,
  `Notice`, `SpaceLine`, `WhenRow`. Don't invent a new look. After adding
  or moving a use of a shared component, run `npm run components` and
  commit `src/component-uses.js`.
- **Wording:** "space", never "organisation". Owner-facing text follows
  `CLAUDE.md`.
- **`npm run check` takes about 20 minutes.** While working, run single
  files: `node --test tests/spaces.test.mjs`, `npm run lint`,
  `npm run typecheck`, `node tests/smoke.mjs`. A fresh checkout needs
  `npm ci` first.
- **Every user-record write that adds or changes a field goes through
  `updateJson`**, not `writeJson(store, K.user(h), { ...me, … })`. Two
  requests can write one account at once (a `practiced` stamp and a
  `join-space`), and a spread of a stale `me` would drop one of them. The
  existing `touch` helper uses `writeJson`; change it to `updateJson` in
  stage 1 (see B3, `practiced`).
- If something isn't covered here, or the code disagrees with this plan,
  ask the owner; don't guess.

## B1. Data model

All in `server/api/courses.js`. No key map (`K`) changes. No migration
pass: every new field has a default rule, like `org` did.

**Fields added to the user record**

| field | meaning | default when absent |
|---|---|---|
| `orgs: string[]` | the spaces this account is in, in the order joined | `[orgOf(user)]` — the one space it has today |
| `suspendedIn: { [org]: { at, by, why, courses } }` | per-space suspension; the inner record is exactly today's `user.suspended` | `{}`, except that an old `user.suspended` reads as `suspendedIn[orgOf(user)]` |
| `lastLearnedIn: { [org]: Millis }` | last practised, per space | see `lastLearnedFor` below |
| `lastTaughtIn: { [org]: Millis }` | last made or changed material, per space | see `lastTaughtFor` below |

`user.org` **stays** and is still written on new accounts (`org: <first
space>`), so that `orgOf(user)` keeps meaning "the first space" for any
reader this plan misses and for a backup restored into an older build.
`user.lastSeen` and `user.lastLearned`/`lastTaught` (account-wide) stay and
are still stamped; Super admin reads them (A2, 3a).

**The gone record** (`K.gone(handle)`, written by `wipeAccount`) gains
`orgs: string[]` beside `org` (which keeps the first).

**Helpers**, placed next to `orgOf` / `inScope` (around line 657):

```js
/** The spaces an account is in. One written before memberships is in its one space. */
const memberOf = (u) => (u && Array.isArray(u.orgs) && u.orgs.length ? u.orgs : [orgOf(u)]);
/** A user record, as opposed to a card, deck, course or flag: only users carry `admin`. */
const isUserRec = (rec) => !!rec && typeof rec.handle === "string" && typeof rec.admin === "boolean";
/** This account's suspension in one space, or null. Reads the old one-space field too. */
const suspensionIn = (u, org) => {
  if (!u) return null;
  if (u.suspendedIn && u.suspendedIn[org]) return u.suspendedIn[org];
  if (u.suspended && !Array.isArray(u.orgs) && orgOf(u) === org) return u.suspended;
  return null;
};
/** When this account last practised in one space. Account-wide until a per-space stamp exists (A2). */
const lastLearnedFor = (u, org) => (u.lastLearnedIn ? u.lastLearnedIn[org] || 0 : u.lastLearned || 0);
const lastTaughtFor = (u, org) => (u.lastTaughtIn ? u.lastTaughtIn[org] || 0 : u.lastTaught || 0);
/**
 * A user record with its memberships written out: `orgs` always present and
 * any old `suspended` folded into `suspendedIn`. Every write that changes
 * memberships goes through this first, so the old field is never read
 * beside the new one.
 */
function normalisedUser(u) {
  const { suspended, ...rest } = u;
  const orgs = memberOf(u);
  const suspendedIn = { ...(u.suspendedIn || {}) };
  if (suspended && !Array.isArray(u.orgs)) suspendedIn[orgOf(u)] = suspended;
  return { ...rest, orgs, suspendedIn };
}
```

**`inScope` learns about users.** Replace the body of `inScope` with:

```js
const inScope = (rec) => {
  const at = orgScope.getStore();
  if (!rec || !at || !at.org) return true;
  if (rec.personal && at.self && rec.owner !== at.self) return false;
  const orgsHere = at.wide ? at.orgs : [at.org];
  if (isUserRec(rec)) return memberOf(rec).some((o) => orgsHere.includes(o));
  return orgsHere.includes(orgOf(rec));
};
```

and widen the `orgScope` type to `{ org: string | null, self: string,
orgs: string[], wide: boolean }`, with the default at line 1216 becoming
`{ org: null, self: "", orgs: [], wide: false }`. `readUser`, `scoped` and
`here` need no change: a user in another space still reads as null
through them.

**What "the acting org" means now** (replaces the lines at 1340–1349):

```js
/* The spaces this account can act in right now: in, not suspended there,
   and the space not closed. App admins act anywhere, as before. */
const orgDocs = new Map();
for (const id of memberOf(me)) orgDocs.set(id, await readJson(store, K.org(id)));
const active = memberOf(me).filter((id) => {
  const o = orgDocs.get(id);
  return o && !o.archived && !suspensionIn(me, id);
});
if (!iAmAdmin && !active.length && !JOINS.has(action)) {
  return json({ error: memberOf(me).some((id) => suspensionIn(me, id)) ? "suspended" : "space-closed" }, 403);
}
const asked = String(req.headers.get("x-org") || "");
let acting;
if (iAmAdmin) acting = asked && (await readJson(store, K.org(asked))) ? asked : orgOf(me);
else acting = asked && active.includes(asked) ? asked : active[0] || orgOf(me);
const scope = orgScope.getStore();
if (scope) {
  scope.org = acting;
  scope.self = mine;
  scope.orgs = iAmAdmin ? [acting] : active;
  scope.wide = WIDE.has(action);
}
```

Delete the two refusals above it (`if (me.suspended) …` at 1327 and the
closed-space block at 1330–1333); the `active` check replaces both. The
same replacement goes into `signin`/`whoami` (B3).

Two sets, declared next to `SPACE_ADMIN_MAY`'s style near the top of
`handle`:

```js
/* Actions that read across every space the caller is in: what a learner
   holds is the union of their spaces. Everything else acts in one. */
const WIDE = new Set(["my-material", "report-flag", "practiced"]);  // built: not my-courses, which is Teaching's list
/* Actions a key may use even with no space to act in: the code decides. */
const JOINS = new Set(["join-course", "join-space"]);
```

`iRunThis` (line 1355) becomes
`!!actingOrgDoc && active.includes(acting) && (actingOrgDoc.admins || []).includes(mine)`.

## B2. One rule, restated

Unchanged from `docs/PLAN-spaces.md` B3: a request acts in one org, and a
record from another reads as missing. What changes is *which* org a
member acts in (the one `x-org` names, if they are in it) and that four
learner actions act in all of theirs at once. A user record is "in scope"
when one of its memberships is in scope. Nothing crosses between spaces:
the union is of the caller's own memberships and nothing else.

Add the member-in-both case to `tests/spaces.test.mjs` (B6, stage 1): a
person in Main and Lingua, and the checks that each space's admin sees
only their side of them.

## B3. Actions, one by one

Line numbers are those of 0.563's `server/api/courses.js`, where this
plan was read; `beta` has moved since. Find each place by the action name
or function name given, and treat the number as a hint only.

**`signup` (1256).** Write `orgs: [orgId]` beside `org: orgId`. Nothing
else changes.

**`signin` / `whoami` (1297).** Replace the suspended and archived checks
with the `active` computation from B1 (copy it; it runs before the
general one because these two actions return early). Then:

- `at` = the `org` query parameter, as today. If `at` is in `active`,
  that is the acting org; otherwise the first of `active`. **No
  `other-space` error any more** for a member (an App admin keeps today's
  behaviour: `at` wins when it exists). An account with no active space:
  if a `code` query parameter is given and names a valid invitation or
  course code, run `joinByCode` (below) first and recompute `active`;
  otherwise answer `suspended` / `space-closed` as the general rule does.
- Answer `org: orgCard(actingDoc)`, `orgAdmin` for the acting org, and
  `orgs: active.map((id) => orgCard(orgDocs.get(id)))`. Strip `keyHash`,
  `orgs` (the raw id list — the card list replaces it), `suspendedIn`,
  `lastLearnedIn`, `lastTaughtIn` from the answer.
- `touch(store, me, "lastSeen")` stays account-wide.

**`practiced` (1380).** Accept `body.orgs` (array of org ids). Stamp
`lastLearned` as today and `lastLearnedIn[o]` for each `o` in `body.orgs`
that is in `memberOf(me)`. A body without `orgs` (an older build) stamps
`lastLearnedIn[acting]`. Rewrite `touch` (738) as an `updateJson`:

```js
const touch = (store, user, field, orgs = []) =>
  updateJson(store, K.user(user.handle), (cur) => {
    if (!cur) return null;
    const now = Date.now();
    const per = `${field}In`;
    const map = { ...(cur[per] || {}) };
    for (const o of orgs) map[o] = now;
    return { ...cur, [field]: now, ...(orgs.length ? { [per]: map } : {}) };
  });
```

`taught()` (1374) becomes `touch(store, me, "lastTaught", [acting])`.
`lastSeen` is called with no orgs and writes no map.

**`delete-account` (1390).** Unchanged; `wipeAccount` does the work.

**`report-flag` (1411).** Stamp `org: flagged ? orgOf(flagged) : acting`
(line 1439), since with `wide` the card may be another of the caller's
spaces. Everything else unchanged.

**`join-course` (3675) and the new `join-space`.** Both call one helper
and the action name no longer matters (the client sends `join-course`
from the course-code box and `join-space` from an invitation; the server
treats them alike). Replace the body of `join-course` with
`return joinByCode(given)`, and add `if (action === "join-space") return joinByCode(…)`
right under it.

The membership itself is written by one helper, shared with
`admin-add-member` below. Define it next to `wipeAccount` (it takes the
store, not the request):

```js
/**
 * Putting an account into a space it is not in, or back into one it left:
 * the membership written once, and a rejoin treated as a reactivation
 * (0.544) — back on the courses the suspension kept, off Former members.
 * Returns the fresh user record, or null when the account is gone.
 * The caller has already checked the space exists and is open, and that
 * the person was not *removed* from it — whoever removed them puts them
 * back, through admin-reactivate-user or admin-add-member.
 */
async function addMembership(store, handle, orgId) {
  const before = await readJson(store, K.user(handle));
  if (!before) return null;
  const was = suspensionIn(before, orgId);
  const fresh = await updateJson(store, K.user(handle), (cur) => {
    if (!cur) return null;
    const u = normalisedUser(cur);
    const orgs = u.orgs.includes(orgId) ? u.orgs : u.orgs.concat([orgId]);
    const { [orgId]: _gone, ...suspendedIn } = u.suspendedIn;
    return { ...u, orgs, suspendedIn };
  });
  if (!fresh) return null;
  const scopeNow = orgScope.getStore();
  const kept = scopeNow ? { org: scopeNow.org, wide: scopeNow.wide } : null;
  if (scopeNow) { scopeNow.org = orgId; scopeNow.wide = false; }
  if (was) {
    /* Back on the courses they were on, the way admin-reactivate-user does it. */
    for (const c of was.courses || []) { …same loop as 5022–5030, with `handle`… }
    await updateJson(store, K.former(orgId), (cur) => (cur || []).some((r) => r.handle === handle) ? cur.filter((r) => r.handle !== handle) : null);
  }
  if (scopeNow && kept) { scopeNow.org = kept.org; scopeNow.wide = kept.wide; }
  return fresh;
}
```

`joinByCode`, defined inside `handle` after `taught`:

```js
/**
 * Joining by a code (A2): a space's invitation adds the space; a course
 * code adds the space and the course. Someone who left a space rejoins it
 * this way; someone removed from it is refused (its admin reactivates).
 */
async function joinByCode(given) {
  const target = await codeTarget(store, given);
  if (!target) return json({ error: "bad-code" }, 404);
  const orgId = target.kind === "org" ? target.org.id : orgOf(target.course);
  const org = await readJson(store, K.org(orgId));
  if (!org) return json({ error: "no-space" }, 404);
  if (org.archived) return json({ error: "space-closed" }, 403);
  const was = suspensionIn(me, orgId);
  if (was && was.why === "removed") return json({ error: "removed", space: orgCard(org) }, 403);
  if (!(await addMembership(store, mine, orgId))) return json({ error: "bad-key" }, 401);
  const scopeNow = orgScope.getStore();
  if (scopeNow) { scopeNow.org = orgId; scopeNow.wide = false; }
  if (target.kind === "course") {
    const as = target.asTeacher ? "teachers" : "students";
    const joined = await updateJson(store, K.course(target.course.id), (c) =>
      c && !c[as].includes(mine) ? { ...c, [as]: c[as].concat([mine]) } : null);
    const { code, teacherCode, ...safe } = joined || target.course;
    return json({ ok: true, space: orgCard(org), course: safe, role: target.asTeacher ? "teacher" : "student" });
  }
  return json({ ok: true, space: orgCard(org) });
}
```

Delete the `other-space` branch of the old `join-course` (3682–3689); it
cannot happen now.

**`my-material` (3903).** With `wide`, `allCourses` already spans every
active space. Two edits: (a) `teaches` (3913) is for the acting space
only: `allCourses.filter((c) => orgOf(c) === acting).some((c) => isTeacher(c, mine))`,
so the Teaching toggle appears where the person teaches; (b) each course
in `courses` (4000) carries `org: orgOf(c)` explicitly, so the client never
has to know the "absent means Main" rule. `my-courses` (3709): same `org`
stamp on each course.

**`leave-space` (4472).** Unchanged in shape; `suspend` does the work in
the acting org (the client passes the space to leave as `x-org`, which a
member's request may now name). `admin-stays` check stays.

**`suspend(user, why, by)` (4483).** `coursesOf` and `dropFromRosters`
already act in the acting org. Write the suspension per space:

```js
await updateJson(store, K.user(user.handle), (cur) => {
  if (!cur) return null;
  const u = normalisedUser(cur);
  return { ...u, suspendedIn: { ...u.suspendedIn, [acting]: { at: Date.now(), by, why, courses } } };
});
```

and `noteFormer(store, acting, …)` instead of `orgOf(user)`.

**`admin-suspend-user` / `admin-reactivate-user` (5009).** Suspend: `if
(suspensionIn(target, acting)) return ok`. Reactivate: `const was =
suspensionIn(target, acting); if (!was) return ok;` then the course loop
over `was.courses`, then remove the key from `suspendedIn` through
`updateJson` + `normalisedUser` (never `writeJson(... back)`), then the
Former members edit with `acting` for `orgOf(target)`.

**`admin-overview` (4511).** `here(userRows)` now keeps members of the
acting org (B1). For each user row, send the space's view of them:

```js
const { keyHash, orgs: _o, suspendedIn: _s, lastLearnedIn: _l, lastTaughtIn: _t, ...safe } = u;
users.push({
  ...safe,
  suspended: suspensionIn(u, acting) || undefined,
  lastLearned: lastLearnedFor(u, acting),
  lastTaught: lastTaughtFor(u, acting),
  teaching: …, studying: …,
});
```

Nothing in the row says the person is elsewhere.

**`admin-reissue-key` (5439).** After the `no-user` check:
`if (!iAmAdmin && memberOf(target).length > 1) return json({ error: "many-spaces" }, 403);`.
Suspended memberships count: the key would open them once reactivated.

**`admin-delete-user` (5460).** After the existence check: if
`memberOf(target).length > 1 && !iAmAdmin`, call
`removeMembership(store, handle, acting, { why: "removed", by: mine })`
and answer `{ ok: true, removed: "membership" }`; otherwise `wipeAccount`
as today and `{ ok: true, removed: "account" }`. (An App admin deleting
from a space's People deletes the account, as today — the owner's call,
A2.)

**`admin-purge-former` (5099).** Where it calls `wipeAccount` (5127): if
the person still exists and has other memberships, `removeMembership`
with `why: "deleted-by-admin"` instead; else `wipeAccount` as today.

**`admin-hand-over` (5054).** `heir.suspended` → `suspensionIn(heir, acting)`.

**`admin-create-user` (5390).** Write `orgs: [acting]` beside `org: acting`.

**New `admin-add-member`** (A2): the App admin puts an existing account
into a space. App admin only — **not** in `SPACE_ADMIN_MAY`. Body
`{ handle, org }`. Place it beside `admin-org-admins`:

```js
if (action === "admin-add-member") {
  if (!iAmAdmin) return json({ error: "admin-only" }, 403);
  const handle = String(body.handle || "");
  const id = String(body.org || "");
  const org = await readJson(store, K.org(id));
  if (!org) return json({ error: "no-space" }, 404);
  if (org.archived) return json({ error: "space-closed" }, 403);
  const target = await readJson(store, K.user(handle));   // unscoped: they may be in no space of this request's
  if (!target || target.admin) return json({ error: "no-user" }, 404);
  const fresh = await addMembership(store, handle, id);
  if (!fresh) return json({ error: "no-user" }, 404);
  return json({ ok: true, orgs: memberOf(fresh) });
}
```

Unlike `joinByCode`, a person *removed* from the space is put back: the
App admin outranks the space admin who removed them, as with
`admin-reactivate-user`. Already a member: `ok`, nothing written twice
(`addMembership` is idempotent). An App admin's own account is refused
(`no-user`): App admins act in any space without being in it (35a).

**`admin-everyone` (5214).** For each person send `orgs: memberOf(u)` and
`suspendedIn: normalisedUser(u).suspendedIn` (so an old `suspended` is
folded in), strip `keyHash`, keep the account-wide `lastSeen`,
`lastLearned`, `lastTaught` (A2, 3a for Super admin). Keep `org: orgOf(u)`
too for one release, then drop it.

**`admin-orgs` (5237).** `people:` filter by `memberOf(u).includes(o.id)`.

**`admin-org-admins` (5282).** The `add` check:
`!u || !memberOf(u).includes(id) || suspensionIn(u, id)`.

**`admin-archive-org` / `admin-delete-org` (5304, 5326).** `own-space` when
`memberOf(me).includes(id)`. In `admin-delete-org`, the users loop
(5336–5349): `users` = those with `memberOf(u).includes(id)`; for each,
if `memberOf(u).length === 1` do as today, else
`removeMembership(store, u.handle, id, { former: false })`. The gone
records loop (5375–5381): a record whose `orgs` (or `[org]`) includes
`id` has `id` taken out of `orgs`, and is deleted only when nothing is
left.

**`wipeAccount` (1008).** Replace the single-org body with a loop over
`memberOf(user)`:

```js
const scopeNow = orgScope.getStore();
for (const org of memberOf(user)) {
  if (scopeNow) { scopeNow.org = org; scopeNow.wide = false; }
  const was = suspensionIn(user, org);
  const courses = was && was.courses && was.courses.length ? was.courses : await coursesOf(store, handle);
  await dropFromRosters(store, handle);
  await updateJson(store, K.org(org), … remove from admins, as today …);
  await noteFormer(store, org, { …as today…, courses, why, by: who });
}
```

The personal decks and cards, the key, the sync document, the user record
and the `users` index are removed once, after the loop, as today. The
gone record is `{ displayName, org: orgOf(user), orgs: memberOf(user), at }`.
Restore `scopeNow.org` to what it was before the loop.

**New helper `removeMembership(store, handle, org, how)`**, next to
`wipeAccount`:

```js
/**
 * Taking one space away from an account that has others: off that space's
 * rosters and admins, its My space material there deleted, the membership
 * and its stamps gone, and a Former members record unless the space itself
 * is being deleted. Nothing about the person's other spaces is touched.
 */
async function removeMembership(store, handle, org, how = {}) {
  const user = await readJson(store, K.user(handle));
  if (!user) return false;
  const scopeNow = orgScope.getStore();
  const before = scopeNow ? { org: scopeNow.org, wide: scopeNow.wide } : null;
  if (scopeNow) { scopeNow.org = org; scopeNow.wide = false; }
  const was = suspensionIn(user, org);
  const courses = was && was.courses && was.courses.length ? was.courses : await coursesOf(store, handle);
  await dropFromRosters(store, handle);
  await updateJson(store, K.org(org), (o) => o && (o.admins || []).includes(handle) ? { ...o, admins: o.admins.filter((x) => x !== handle) } : null);
  /* Their My space decks and cards in this space: the same walk wipeAccount does, filtered by orgOf(d) === org. */
  …
  await updateJson(store, K.user(handle), (cur) => {
    if (!cur) return null;
    const u = normalisedUser(cur);
    const drop = (m) => { const { [org]: _x, ...rest } = m || {}; return rest; };
    return { ...u, orgs: u.orgs.filter((x) => x !== org), suspendedIn: drop(u.suspendedIn),
             lastLearnedIn: drop(u.lastLearnedIn), lastTaughtIn: drop(u.lastTaughtIn) };
  });
  if (how.former !== false) await noteFormer(store, org, { handle, displayName: user.displayName, joined: user.created || 0, left: Date.now(), courses, why: how.why || "removed", by: how.by || handle });
  if (scopeNow && before) { scopeNow.org = before.org; scopeNow.wide = before.wide; }
  return true;
}
```

**Everything else** (courses, decks, cards, systems, media, backups,
exports, feedback, Super admin's reports) is unchanged: it acts in the
acting org, which for a member is now the address they opened.

**Error codes** to add to `explain()` in `src/courses-api.ts`:

- `many-spaces`: "This person is in more than one space, so only the
  super admin can give them a new key."
- `removed`: "You were removed from that space. Ask its admin to let you
  back in."
- `suspended` (reword): "You're not in any space right now. Ask your
  space's admin, or use an invitation link or a course code."

`other-space` stays for `signup` (a code from one space at another
space's address) and nothing else.

## B4. The client

**Types (`src/types.ts`).** On `User`: `orgs?: { id; slug; name; logo;
colour }[]` ("the spaces this account is in, as whoami answers them;
absent on an older server: just `org`"). Document `suspendedIn`,
`lastLearnedIn`, `lastTaughtIn` as server-only, the way `keyHash` is.

**`src/courses-api.ts`.**

- `whoAmI(key, org?, code?)`: `params` gain `code` when given.
- `joinSpace(code)` → `call("join-space", { body: { code } })`.
- `addMember(handle, org)` → `call("admin-add-member", { body: { handle, org } })`.
- `leaveSpace(org?)` → `call("leave-space", { body: {}, org })`.
- `practiced(orgs: string[])` → body `{ orgs }`.
- `reissueKey`, `suspendUser`, etc. already take `org`.
- A remembered space: `export const LAST_SPACE = "arabic-trainer:last-space"`;
  `rememberSpace(id)` / `lastSpace()` with try/catch, beside
  `loadAccount`.

**Address and sign-in (`src/ArabicTrainer.tsx`, 10231–10280, and
`Onboarding` in `src/spaces.tsx` 191–480).**

- `whoAmI` on launch and on sign-in passes `org` = the address space's id
  if there is one, else `lastSpace()`. On success, `rememberSpace(user.org.id)`.
  The existing effect at 10276 then moves the address to `accountOrg.slug`,
  which is now the server's choice. No `other-space` handling on sign-in:
  remove the `otherSpace(e)` branch from the sign-in handler (spaces.tsx
  ~258) but keep it on sign-up (~234).
- Onboarding's sign-in passes `place.joinCode` as `code`, so an account
  with no active space can get in with the invitation it followed.
- `strayInvite` (10273) becomes: `?join=` present, a space at the address,
  and `!(account.orgs || [accountOrg]).some((o) => o.id === addressSpace.id)`.
  For an App admin, as today, never.
- The stray-invite screen (13738–13790): title "Join {addressSpace.name}?",
  one line "You're signed in as {displayName}. Joining adds {space} to this
  account; your other spaces stay.", `Button` "Join {space}" →
  `API.joinSpace(address.join)` then `API.whoAmI(key, addressSpace.id)` →
  `saveAccount`, `setInviteSetAside(true)`, strip `?join=` with
  `replaceState`; and `Button variant="ghost"` "Not now" → today's "Back
  to {accountOrg.name}". On `removed`, show the explain() sentence in a
  `Notice` on this screen.
- `?join=` for a space the account is already in: strip it and stay.

**You menu (`CornerMenu`, 20239; `SpaceLine`, 20894).** When
`account.orgs` has more than one entry, under the `SpaceLine` render a
`Segmented` of the spaces (label = name, value = slug, current = the
address space's slug). Choosing one: `rememberSpace(id)` then
`window.location.assign(`/${slug}`)`, the way Super admin's Open does
(0.552). Nothing for one space.

**Settings (`LeaveSpace`, 19886; placed at 20749).** Render one
`LeaveSpace` per entry of `account.orgs` when there is more than one, each
with the space's name in its title and confirm ("Leave Lingua?") and
`API.leaveSpace(org.id)`. On success: if other spaces remain, `whoAmI`
again (which lands in another space) and `saveAccount`; if none remain,
today's signed-out path. One space: exactly today's component.

**Course code in Learning (`StudentCourses`, spaces.tsx 8889; `onJoin` at
ArabicTrainer 15304).** After `API.joinCourse(code)` succeeds and the
answer carries `space` not in `account.orgs`, call `whoAmI` and
`saveAccount` so `orgs` updates, then `refreshCourses(true)` as today.

**Learning across spaces (stage 3), in `ArabicTrainer`.**

- `spaceFilter` state: an org id or `""`; read from and written to
  `localStorage` under `arabic-trainer:space-filter` (try/catch, as every
  other key). Reset to `""` if the id is not in `account.orgs`.
- `spaceOfItem(item, courses, decks)`: `item.source.courseId` → that
  course's `org`; `item.source.systemId` → the `org` of the first course
  whose deck has `numbersSystemId` or `timeSystemId` equal to it; otherwise
  `null` (the learner's own card: shown under every filter). Memoise a
  `Map<itemId, org | null>` from `items`, `myCourses`, `courseDecks`.
- `learnItems = spaceFilter ? items.filter((it) => { const o = spaceOf.get(it.id); return o === null || o === spaceFilter; }) : items`,
  and the same for `learnCourses` (by `c.org`) and `learnDecks` (by their
  course). **Use these, and never `items`, wherever Learning reads or
  practises:** `drillable` (feeding `readyOf`, `homeWaiting`, `readyCount`,
  `homePrep` — 11428–11550), `begin` (11998), `beginManual` (11673),
  `beginWeak` (11972), `SavedTiles` (14090), `ProgressTab` (15249),
  `ItemsTab` (15224), `StudentCourses` (15304), the prep and custom-session
  pickers. Grading, merge, sync and `pullCourses` keep the full `items`.
- The row: a `Segmented` (`quiet=""` for All, then one value per
  `account.orgs` entry, label = name) rendered above Learning's tab content
  only when `account.orgs.length > 1`. One component, rendered once, in
  the Learning frame so every tab shares it.
- `StudentCourses` under All with more than one space: a `Section` per
  space (title = space name) holding that space's course tiles; courses
  come with `org` from `my-material`, and the names from `account.orgs`.
  Under a filter, or with one space, exactly today's page.
- `ProgressTab` deck tiles (~19426): the grouping key becomes
  `${spaceOf(firstItem) || ""}|${tag}` when more than one space, and the
  tile's meta line adds the space's name. Under a filter or one space,
  today's tiles.
- `reportLearning` (4004): `API.practiced([...new Set(session items → spaceOf, nulls dropped)])`.

**Admin screens (`src/spaces.tsx`).** Admin → People: no change (the
server sends per-space dates). On `many-spaces`, the existing error
display shows the explain() sentence. Super admin `EveryonePeople` (9624):
`data.people.filter((u) => (u.orgs || [u.org]).includes(o.id) && match(u))`,
and `u.suspended` → `u.suspendedIn && u.suspendedIn[o.id]` in the meta
and the suspend/reactivate choice.

**"Add to a space" (stage 2), in `EveryonePeople`.** On each person's
`Tile` (not an App admin's), an `IconButton icon="add" label="Add to a
space"`. It opens the screen's existing `ConfirmModal` (`setConfirm`)
titled "Add {name} to a space", whose body is a `RadioGroup` of the
spaces in `data.orgs` the person is not in (`!u.orgs.includes(o.id)`),
open ones only; the button reads "Add". Nothing to offer (in every open
space) → the `IconButton` is not rendered. On confirm:
`API.addMember(u.handle, chosen)`, then reload the list (the same
`API.everyone()` call the screen makes at start). The person then appears
under that space too. No key is shown: theirs already opens it.

**Smoke harness (`tests/smoke.mjs`).** The `whoami` stub (368) answers
`orgs: [account.org]` from stage 1. Stage 2 adds `join-space` and the
`org` of `leave-space`; stage 3 adds a walk with two spaces in `orgs`: the
`Segmented` row exists, choosing a space changes `.at-home[data-ready]`,
and `practiced` is sent with `orgs`.

## B5. Pitfalls

- **`orgScope` is per request and mutable.** `wipeAccount`,
  `removeMembership` and `admin-delete-org` move `scope.org` to walk a
  space; put it back afterwards, or every read for the rest of the request
  is in the wrong space. `admin-delete-org` already does this at 5333.
- **`wide` must be off while writing.** `joinByCode`, `suspend` and the
  removal helpers set `scope.wide = false` before touching rosters, or
  `dropFromRosters` (which filters by `inScope`) walks every space.
- **`here()` on user rows** now means "members of the acting org". Where a
  row is read straight from `readJson(store, K.user(h))` (not through
  `readUser`/`here`), it is unscoped: `admin-everyone`, `admin-orgs`,
  `admin-org-admins`, `sweepStudentMySpace`. Those filter by `memberOf`
  explicitly.
- **Never read `user.suspended` or `user.org` directly** in new code; go
  through `suspensionIn` and `memberOf`. `grep -n "\.suspended\b\|orgOf(u\|orgOf(me\|orgOf(target\|orgOf(user" server/api/courses.js`
  after each stage: every hit must be one this plan names.
- **The `PLACED` table in `tests/spaces.test.mjs`** (257–291) must gain
  `join-space` (under `crossed`) and `admin-add-member` (under `spaces`),
  or the "every action is placed" test fails.
- **Deck titles are tags.** Progress groups by `item.tags`; two spaces may
  each have "Lesson 1". Stage 3 keys the tiles by space as well (B4).
- **`TEACHES_KEY`** (ArabicTrainer 10039) caches whether Teaching shows.
  It is now per address; a switch reloads the page, so it refreshes.
- **`explain()` compares messages exactly.** New codes need their sentence
  or the screen shows the bare code.
- **Backups.** A restored user record carries `orgs`; nothing to do. An
  export of one space (`admin-export-org-manifest`) filters users through
  `here`, so a person in two spaces is in both exports, which is right.

## B6. Stage checklists

Each stage is one release, numbered as whatever is next on `beta` when it
ships (0.569 or later); "stage 1's release" below means that number.

### Stage 1 — memberships underneath

Server (`server/api/courses.js`):
- [ ] B1 helpers, `inScope` for users, the `orgScope` shape, `WIDE`, `JOINS`.
- [ ] The acting-org block and the removal of the two account-wide refusals.
- [ ] `signup`, `admin-create-user` write `orgs`.
- [ ] `signin`/`whoami`: `active`, landing, `orgs` in the answer, `code`.
- [ ] `touch` as `updateJson`; `practiced` with `orgs`; `taught` per space.
- [ ] `report-flag` org stamp; `my-material` `teaches` and `org` on courses; `my-courses` `org`.
- [ ] `addMembership`; `joinByCode`; `join-course` and `join-space` through it; `admin-add-member`.
- [ ] `suspend` per space; suspend/reactivate; `leave-space` by `x-org`.
- [ ] `admin-overview` per-space view; `admin-reissue-key` rule; `admin-delete-user`; `admin-purge-former`; `admin-hand-over`.
- [ ] `admin-everyone`, `admin-orgs`, `admin-org-admins`, archive/delete org.
- [ ] `wipeAccount` loop; `removeMembership`.
- [ ] `explain()` sentences; `User` type fields.
- [ ] Smoke stub: `whoami` answers `orgs`.

Tests (`tests/spaces.test.mjs`), a new block "memberships (0.564)":
- [ ] `both`: Main's student joins Lingua's course by its code → 200; `whoami` at Lingua's address answers `org` Lingua and two `orgs`; at Main's, Main.
- [ ] `my-material` for `both` lists both courses, each with `org`; `teaches` false at both addresses; Lingua's teacher's `my-material` lists only Lingua's course.
- [ ] `whoami` for Main's student at Lingua's address (no join) → 200 with `org` Main (no `other-space`).
- [ ] Signed-in `join-space` with Lingua's invitation code → 200; a second time → 200 and no duplicate membership.
- [ ] `leave-space` by `both` with `x-org` Lingua → Lingua's Former members lists them, Main's doesn't; `my-material` lists Main's course only; `join-space` with the invitation puts them back and clears the record.
- [ ] `admin-suspend-user` by Lingua's admin → suspended in Lingua only; `admin-overview` of Main shows them unsuspended; reactivate by Lingua's admin.
- [ ] `admin-reissue-key` for `both` by Lingua's admin → 403 `many-spaces`; by the App admin → 200; for Lingua's own student by Lingua's admin → 200.
- [ ] `practiced` with `orgs: [main]` → Main's `admin-overview` shows `lastLearned` now, Lingua's shows 0; `admin-everyone` shows the account-wide stamp.
- [ ] Archive Lingua → `whoami` for `both` → 200 with `org` Main and one entry in `orgs`; `my-material` without Lingua's course; reopen.
- [ ] `admin-delete-user` for `both` by Lingua's admin → `removed: "membership"`, still signs in, in Main only; rejoin by course code.
- [ ] `delete-account` by `both` → Former members record in both spaces; key refused.
- [ ] `admin-delete-org` of a third space with a member who is also in Main → that member still signs in.
- [ ] `admin-add-member` for Main's teacher into Lingua by the App admin → 200 with two `orgs`; by Lingua's admin → 403 `admin-only`; a second time → 200 and no duplicate; for the App admin's own handle → 404; into an archived space → 403 `space-closed`; for someone Lingua's admin removed → 200, back on their courses, off Former members.
- [ ] `PLACED.crossed` gains `join-space`; `PLACED.spaces` gains `admin-add-member`.

Docs: `CHANGELOG.md` entry in A's terms; `README.md` "Memberships (since
stage 1's release)"; `DECISIONS.md` for the key rule, per-space stamps,
and "a course code joins the space".

### Stage 2 — joining and moving around

- [ ] `courses-api.ts`: `joinSpace`, `addMember`, `leaveSpace(org)`, `whoAmI` with `code`, `rememberSpace`/`lastSpace`.
- [ ] Super admin → People: "Add to a space" on each person's tile.
- [ ] Launch and sign-in pass the address or remembered space; remember on success; drop `otherSpace` on sign-in.
- [ ] `strayInvite` by membership; the "Join {space}?" screen; `removed` notice; `?join=` for a space already joined.
- [ ] You menu `Segmented` of spaces; reload on choice.
- [ ] Settings: one `LeaveSpace` per space; landing after leaving.
- [ ] Course-code join refreshes the account when a new space is joined.
- [ ] Smoke: `join-space`, `leave-space` with `org`, a walk through "Join {space}?".
- [ ] `npm run components`; docs as for stage 1.

### Stage 3 — Learning across spaces

- [ ] `spaceFilter` state and storage; `spaceOfItem` map; `learnItems`/`learnCourses`/`learnDecks` in every place B4 lists.
- [ ] The `Segmented` row in the Learning frame, only with more than one space.
- [ ] `StudentCourses` sections per space under All.
- [ ] `ProgressTab` tiles keyed and labelled by space.
- [ ] `reportLearning` sends `orgs`.
- [ ] Super admin People by `orgs`/`suspendedIn`.
- [ ] Smoke walk with two spaces; `tests/session-mix` untouched (the pool is narrowed before it).
- [ ] `npm run components`; docs as for stage 1; check by hand on the deployed app with one account in two spaces: Home's count changes with the row, a session started under a space holds only its cards, Progress and Cards follow, Admin → People of each space shows its own "Last practised".
