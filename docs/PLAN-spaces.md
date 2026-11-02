# Plan: spaces

**Status: draft, not started.** Written before anything is built, after the
brainstorm with the owner (questions 1–67) and a reading of the repository.
Section A6 lists the questions still open. Stages that depend on an open
question must not start until it is answered and this document is updated.

Part A is for the owner, in plain terms. Part B holds the build notes for
whoever implements it. It is long because the owner asked for a plan
detailed enough to hand to another model.

---

# Part A — for the owner

## A1. What this is

A **space** is a walled-off area of ManyTongues for one organisation, such
as a language school. Each space has its own people, courses, decks and
cards, and its own address: `manytongues.co/<name>`. Nothing in one space
can be seen or touched from another. You (the app admin) create spaces and
choose who runs each one. The people who run a space are its **space
admins**.

Everything that exists today becomes the first space, called "main". Its
address is `manytongues.co/main`.

Every person also has **My space**: a private corner of their own account
where they can make their own decks and cards, practise them, and (for
teachers) prepare material before sharing it.

## A2. The decisions

The number after each decision is the question it was settled in.

**People and accounts**

- **One account belongs to exactly one space (owner's rule, replacing 1b).**
  Someone who wants to be in two spaces has two accounts, each with its own
  key.
- **The address decides.** Being at a space's address means being in that
  space. There is no space switcher.
- **Everything existing goes into "main" (2a), at `manytongues.co/main`
  (17a).** Nothing exists without a space. The plain home page is only for
  signing in, and it sends you to your own space.
- **The app's address is `manytongues.co` (11).**
- **Joining (3c, 24b, 23a, 37a).** A space admin can create accounts and
  hand out the keys. Each space also has one invite link, which the space
  admin can replace. Joining through it gives no role until the space admin
  assigns one. A course code also works as an invite into that course's
  space. Nobody can sign up without an invite link or a course code.
- **Wrong address (9a, 53b).** Someone who opens a space they don't belong
  to sees that space's page with a box for an invite code. If they sign in
  there, or use a code from another space, they are stopped and told which
  space their key belongs to. They are offered two ways forward: go there,
  or make a new account here.
- **Leaving and removing (25a, 52a, 64a, 67a).** A person can leave their
  space, and a space admin can remove someone. Either way the account is
  **suspended**, not deleted: the person can't sign in, and a record is
  kept under **"Former members"**. That record shows when they joined and
  left, which courses they were in, and whether they left or were removed.
  The space admin, or you, can reactivate them. **Only you can delete an
  account.**
- **Accounts don't move between spaces (49c), with one exception (57a):**
  when you move a course out of "main" into another space, you decide
  person by person who goes with it (50c), and their progress comes along.
  Otherwise, changing space means a new account that starts from zero.
- **Lost keys (51b, 34c).** A space admin can issue a new key to people in
  their space. The sign-in page tells people to ask their space's admin. A
  contact address for you is shown for everyone else: people in "main" and
  space admins.
- **Key reminder (18a, 19b).** Right after signing up, and the first time
  someone signs in to an account another person made for them, they are
  asked to save their key in a password manager or somewhere safe. They
  tick "I've saved my key somewhere safe" before carrying on.

**Roles**

- **You (app admin)** create, rename and archive spaces. You set each
  space's name, address, logo and colour (21a), and choose its space admins
  (36a). You can open any space and work there without appearing in its
  list of people (35a). Deleting accounts and courses, backups and
  restores, and exporting a whole space (63a) are yours alone.
- **Space admins.** A space can have several (20b). They handle the
  day-to-day (4b): create courses (32a), add people and make them teachers
  or students, issue new keys (51b), suspend and reactivate people (64a,
  67a), share and replace the invite link (37a), read learners' reports
  (7a), and see and edit all of the space's material (6a). They cannot see
  anyone's My space (48a).
- **Teachers and students** work as today: memberships of a course. Only
  teachers and space admins make material in the space (33a).

**Material**

- **Teachers own the cards they make (6a).** When a teacher leaves, their
  material stays under their name, and the space admin can hand it to
  someone else (31a).
- **No sharing between spaces.** Copying something into another space
  makes a separate copy, with a warning that the two won't stay in sync
  (15a). You publishing material for several spaces means you copying it
  in.
- **Numbers, clock and blank-fillers (39a, 46c).** Each teacher's numbers,
  clock and blank-fillers stay their own, inside their space. A deck that
  includes numbers says whose numbers it uses, chosen from the teachers in
  the space who have numbers in that language. It starts with the deck
  owner's own numbers, if they have any. This is the same idea as building
  a deck from another teacher's cards.

**My space (13a, 14a, 47a, 48a, 54, 55a, 56a, 58a, 59b, 61a, 66b)**

- Everyone has one. It's private: only its owner sees it. Space admins
  don't, and nobody else can join it.
- It works exactly the same for learners and teachers: the same editor,
  decks, cards, and Draft/Published steps. Only published cards are
  practised.
- **Teachers** reach it as a "My space" shelf inside Teaching, next to the
  space's own material.
- **Learners** reach it through "My space" in the You menu, next to
  Learning. It opens the same screens as Teaching, limited to My space.
- Each My space deck has **"Practise this myself"**, on for new decks. It's
  a tick box on the deck's own screen, where a space deck shows its courses
  (61a). In the shelf's list, a deck that's ticked off shows "Not
  practised".
- In Learning, practised My space decks appear as one more group called
  **"My space"**, next to the person's courses. They're practised in the
  same daily sessions (56a).
- A My space deck can include cards from the person's courses. It's the
  same card, practised once, and it drops out if the space withdraws it
  (66b).
- A teacher can copy a My space deck into the space, for a course. The
  copy belongs to the space from then on (15a).

**Addresses and look**

- A space's address can be changed later. The old address keeps
  forwarding, and an address that has ever been used can never be taken by
  another space (8b).
- Each space has a name, logo and colour (10b), set only by you (21a). They
  appear on the space's sign-in and invite page and inside the You menu.
  The rest of the app keeps ManyTongues' own colours (29a).
- The app always says "space", never "school". For example: "This space is
  closed".
- Everything is built from the app's existing screens and pieces. Anything
  that has no existing piece is shown to you before it's built.

**Closing a space (22a, 62a)**

- A space is archived, not deleted. Its people see "This space is closed"
  when they try to sign in. Reopening it brings everything back.
- **Storage (60a):** no limit for now. Your admin screen shows how much
  each space uses.

**Moving courses out of "main" (40b, 41b, 42a, 50c, 57a)**

- You choose a course and the space it moves to. Then, person by person,
  you choose who goes with it. Those who go leave "main".
- A course can't move while it shares a deck with a course that stays
  behind.
- Decks not in any course went into "main" at launch, like everything
  else.

**Dropped along the way:** ticking several spaces at once, the space
switcher, and personal addresses like `/@handle`. Each was overtaken by
"one account, one space" or "My space is part of the account".

## A3. What each kind of person will see

- **A learner** opens their space's address (or the app) and signs in.
  They see their space's name and logo in the You menu. Learning holds
  their courses and, once they've made something, a "My space" group.
  "My space" in the You menu opens the screens where they make their own
  decks and cards.
- **A teacher** sees what they see today, limited to their space. Teaching
  gains a "My space" shelf.
- **A space admin** sees an Admin screen like today's, showing only their
  space: courses, people (with "Former members"), decks, reports, and the
  invite link. The backup and clear controls are not there.
- **You** see today's Admin screen plus a **Spaces** section. There you
  create, edit, archive and export spaces, choose space admins, see each
  space's storage use, and (later) move courses. You can open any space's
  address and work there.

## A4. Stages

Each stage is a release that can ship on its own. It's checked with the
full test suite plus new tests, then by hand on the deployed app before
the next stage starts.

1. **Numbers by choice (46c).** A deck says whose numbers it uses. This
   fixes a problem that exists today (a course with two teachers who both
   have numbers gives students every number twice), so it can ship before
   spaces.
2. **Spaces underneath.** Every person, course, deck and card belongs to a
   space, and the server refuses anything that crosses one. Everything is
   in "main", so nobody notices anything. Checked by tests that try every
   kind of request from one space against another.
3. **Creating spaces, and addresses.** Your Spaces section: create a space
   with its first space admin, rename its address, archive and reopen. The
   space's own sign-in page with its logo and colour, the address always
   showing your space, the "wrong address" message, and sign-up only by
   invite or course code.
4. **Space admins.** Their Admin screen, the invite link, suspending and
   reactivating, "Former members", leaving a space, reports going to the
   space admin, the key reminder, and the new lost-key wording.
5. **My space.** The shelf in Teaching, "My space" for learners,
   "Practise this myself", the My space group in Learning, adding course
   cards to My space decks, and copying a deck into the space.
6. **Your extras.** Export a whole space, storage per space, and moving a
   course out of "main".

Stages 2 to 4 together are the smallest version a real school could use.
Stages 5 and 6 can follow later.

## A5. Costs and trade-offs accepted

- Someone in two spaces has two keys and signs out and in to switch. Each
  switch downloads that account's material again.
- A person who changes space starts from zero, unless their whole course
  moves with them.
- Copying material between spaces means separate copies. A mistake found
  later is fixed in each copy.
- Learners get the full teachers' editor in My space. It's powerful, but a
  lot for a beginner.
- A space admin who issues someone a new key could also open that
  person's My space.

## A6. Open questions

These were found while writing this plan. They're asked in the
conversation in the usual way, and this section is updated with the
answers before building starts.

- 68 — Deleting your own account (today anyone can).
- 69 — The name "main" shows to its members.
- 70 — Space admins acting on other space admins.
- 71 — Whether you see people's My space.
- 72 — Whether a space's export includes its people's My space.
- 73 — Whose numbers a My space deck can use, and who sees a learner's
  numbers.
- 74 — The single sign-up code the app can require today.
- 75 — The contact address for lost keys.
- 76 — Moving a course when a card is also in a deck that stays behind.
- 77 — Moving a course when one of its teachers stays in "main".
- 78 — Whether moving courses is needed in the first version at all.
- 79 — Whether space admins can edit a teacher's numbers and clock.
- 80 — Shipping "numbers by choice" first, ahead of spaces.
- 81 — Showing the key reminder once to people who already have accounts.
- 82 — A signed-in person following another space's invite link.

The app's address is taken as `manytongues.co` from your later messages.
Question 11 was never answered directly.

---

# Part B — Build notes (technical, for the implementer)

## B0. Ground rules

- Read `CLAUDE.md` and the parts of `README.md` and `DECISIONS.md` your
  stage touches before writing code. Follow the repository's delivery
  rules: each stage is a release (bump `package.json`, write a
  `CHANGELOG.md` entry in the README's terms, add a `DECISIONS.md` entry
  for each choice made), `npm run check` must be green on the exact tree
  pushed, and push to `beta` as `CLAUDE.md` describes.
- **Only existing UI components and layout.** Read
  `docs/UI-COMPONENTS.md` first and run `npm run components`. The pieces
  you will need are already there: `SpaceFrame` + `Tabs`, `Section`,
  `Field`/`FormField`, `Segmented`, `CheckList`, `RadioGroup`, `ItemList`,
  `Tile`, `Notice`, `Nudge`, `Help`, `Lede`, `Button`, `IconButton`,
  `ConfirmModal`, `Popover`, `DeckSwitch`. If something genuinely has no
  existing piece, stop and ask the owner. Don't invent a new look.
- **Wording.** Text people see says "space" (or the space's name), never
  "school", "organisation" or "tenant". It also follows the CLAUDE.md
  rules for owner-facing language.
- Don't start a stage whose open questions (A6) are unanswered.

## B1. Naming in code: `org`, not `space`

The code already uses **space** for Learning/Teaching/Admin: `SpaceName`
in `src/ArabicTrainer.tsx` and `src/shared.tsx`, `SPACE_LABEL`,
`SPACE_ICON`, the `space` state, `PlacePicker`, `useFreshSpace`,
`SpaceFrame`, and the file `src/spaces.tsx` (the Teaching and Admin
screens). Reusing the word for the new idea would make every one of those
ambiguous.

So **in code, the new concept is `org`**: `K.org`, `user.org`, `orgOf()`,
`sameOrg()`, the actions `admin-create-org`, and so on. **On screen it is
always "space".** Leave the existing `space` identifiers alone. Change
only the screen-reader label on `PlacePicker`'s radiogroup (today
`aria-label="Space"`) to `aria-label="Mode"`, so a screen reader doesn't
call two different things "space".

## B2. Data model

All documents live in the `arabic-courses` store (`server/api/courses.js`,
`STORE`), reached through the `K` key map. Nothing lists keys; every list
is an `index:` document. Add:

```
K.org(id)      → `org:${id}`      the space itself
K.slug(name)   → `slug:${name}`   address → org id; NEVER deleted (8b)
K.index("orgs")                   list of org ids
```

**Org document**

```js
{
  id,              // "main" for the first; otherwise `o${randomBytes(6).toString("hex")}`
  slug,            // current address part, e.g. "lingua-academy"
  formerSlugs: [], // every slug it has had; each still has its K.slug record
  name,            // shown on screen
  logo,            // image hash (stored with put-image, as card pictures are) or ""
  colour,          // "#rrggbb" or ""
  admins: [],      // handles of space admins (20b, 36a); the source of truth for the role
  inviteCode,      // the space's invite link code (37a); also recorded under K.code
  created,
  archived,        // millis, absent when open (22a)
}
```

**Address rules:** lowercase `a–z`, `0–9` and `-`, 3–40 characters, must
start with a letter, no `--`. Reserved, never allowed: `api`, `assets`,
`main` (taken by the first space), `admin`, `new`, `join`, `www`, `app`,
`static`, `index`, and the name of every file in `public/` and `dist/`
without its extension (`favicon`, `logo`, `apple-touch-icon`,
`icon-192`, `icon-512`, `icon-512-maskable`, `manifest`,
`manifest.webmanifest`, `sw`, `registerSW`, `workbox`). A slug whose
`K.slug` record exists is taken for ever, even after a rename (8b).

**Fields added to existing records.** None of them need a migration
write, because of the default rule below.

| record | new field | meaning |
|---|---|---|
| user | `org` | id of the user's one space |
| user | `suspended` | `{ at, by, why: "left" \| "removed", courses: [{ id, roles: ["teacher"\|"student"] }], joined }` while suspended; absent otherwise |
| user | `keySaved` | `false` on accounts created from this release on, until the person ticks; absent (= saved) on older accounts (18a: no reminder for existing people) |
| user | `formerOf` | optional; see the Former members record below |
| course | `org` | its space |
| deck | `org` | its space |
| deck | `personal` | `true` for a My space deck |
| deck | `practise` | My space decks only: "Practise this myself" (59b); `true` when created |
| deck | `numbersFrom` | handle whose numbers and clock the deck uses (46c); absent = deck owner |
| card | `org` | its space |
| card | `personal` | `true` for a card made in My space |
| flag | `org` | the space of the card's deck, stamped when the report is made |

**The default rule, the most important line in this plan:**

```js
const MAIN = "main";
const orgOf = (rec) => (rec && rec.org) || MAIN;
```

A record without `org` is in "main". Every existing record is therefore
already in "main" (2a, 42a), and **no migration pass is written**. Never
read `.org` directly; always go through `orgOf`.

On startup (or on the first request, inside `courses.js`), make sure
`org:main` exists:
`{ id: "main", slug: "main", formerSlugs: [], name: <see question 69>, logo: "", colour: "", admins: [], inviteCode: <new makeCode()>, created: Date.now() }`,
plus `slug:main` and the `index:orgs` entry. Write it with `onlyIfNew`
so two starts can't race.

**Former members.** Keep the record on the user document itself (it is
never deleted while suspended), and list them by filtering `index:users`
by org and `suspended`. When an account is reactivated, clear `suspended`
and put the person back on each course in `suspended.courses` that still
exists, with the same roles. When you (app admin) delete an account, it
disappears from "Former members". The space admin's view keeps no history
of deleted accounts. Show the owner this consequence when stage 4 is
demonstrated.

## B3. The one rule on the server

```js
/** The space this request acts in. Async: it may read the org document. */
async function actingOrg(store, req, me) {
  if (me.admin) {
    const asked = String(req.headers.get("x-org") || "");
    // validated: the org must exist; otherwise fall back to the admin's own
    if (asked && (await readJson(store, K.org(asked)))) return asked;
  }
  return orgOf(me);
}
const sameOrg = (rec, org) => orgOf(rec) === org;
const isOrgAdmin = (org, handle) => (org.admins || []).includes(handle);
```

- **App admin** = today's `admin` flag (made with `claim-admin` and
  `ADMIN_KEY`). Unchanged. App admins may act in any space (35a); the
  client sends `x-org` with the id of the space whose address is open.
- **Everybody else** acts in their own space. The `x-org` header is
  ignored for them.
- **Every action that reads or writes a course, deck, card, system, flag
  or user must check `sameOrg(record, acting)`** and answer
  `json({ error: "other-space" }, 403)` when it fails. An App admin
  passes because `acting` is whatever they asked for, not because the
  check is skipped. **Every list must be filtered by `sameOrg`** before
  anything else is done with it.
- **Personal records** (`deck.personal`, `card.personal`) are visible and
  editable only by their owner, whatever their role. That includes the
  space admin (48a) and, pending question 71, the App admin. A personal
  deck is never in a course.
- **A suspended user is refused** on every action, including `signin` and
  `whoami`, with `json({ error: "suspended" }, 403)`.
- **An archived space refuses its people** in the same way:
  `json({ error: "space-closed" }, 403)`. App admins are not refused.

Put `actingOrg`, `sameOrg`, `orgOf`, `isOrgAdmin` and a
`refuseOther(rec)` helper next to `currentUser` near the top of
`courses.js`, and use them everywhere. Don't write the comparison inline.

## B4. Existing actions, one by one

`me` is `currentUser`, `org` is `actingOrg`, and "space admin" means
`isOrgAdmin(orgDoc, me.handle)`.

**Accounts**

- **`signup`**: needs `body.code`, either a space invite code or a course
  code (24b, 23a). Look it up with an extended `courseForCode`, renamed
  `codeTarget` and returning `{ kind: "org" | "course", id, asTeacher }`.
  The new user's `org` is the code's space. If `body.org` (the space of
  the address the person is at) is given and differs, answer
  `{ error: "other-space", space: { name, slug } }` (53b). Set
  `keySaved: false`. A course code also puts them on that course, as
  student or teacher as `join-course` does. An invite code gives no role
  (37a). Refuse when the space is archived. **`SIGNUP_CODE`**: see
  question 74.
- **`signin` / `whoami`**: refuse suspended users (`suspended`) and
  archived spaces (`space-closed`). If `body.org` is given and differs
  from the user's, answer
  `{ error: "other-space", space: { name, slug } }` without signing in.
  The answer gains `org: { id, slug, name, logo, colour }`,
  `orgAdmin: boolean` and `keySaved`.
- **`delete-account`**: today it wipes the account. See question 68. The
  planned answer replaces it with **`leave-space`**: it sets `suspended`
  with `why: "left"` and removes the person from every course roster.
- **`claim-admin`**: unchanged.
- **`report-flag`**: stamp `org` from the deck or card. A card that's
  personal and not in any course isn't reportable. Answer `not-reportable`,
  and the client hides the button for such cards.

**Courses**

- **`create-course`**: today `me.admin` only. Becomes App admin or space
  admin. Stamp `org`.
- **`assign-teacher` / `assign-student` / `remove-member`**: today
  `me.admin` only. Becomes App admin or space admin. The course and the
  target user must both be in `org`.
- **`join-course`**: the course must be in the user's space. Otherwise
  answer `{ error: "other-space", space: { name, slug } }` (53b).
- **`my-courses`, `course-decks`, `my-material`**: filter courses by
  `org`.
- **`my-material`** also gains the person's practised My space decks
  (59b). Build them as a **pseudo-course**
  `{ id: "my-space", title: "My space", personal: true, decks: [...ids], teachers: [], students: [mine] }`.
  It is added to `courseRows` only for this answer and never stored. This
  lets `StudentCourses` and the rest of Learning treat it as a course with
  almost no change. Include its decks, and the cards in them (the person's
  own cards *and* the course cards they added, 66b), in the bundle and in
  `materialVersion`. A course card in a personal deck is sent only while
  that card is still in a course the person studies. Otherwise it's left
  out (66b: it "drops out if the space withdraws it"). The client must not
  offer "leave" or show codes for a course with `personal: true`.

**Decks**

- **`create-deck`**: stamp `org`. Accept `body.personal`. Personal decks
  get `practise: true`. Anyone may create a personal deck. Only teachers
  of a course in the space, space admins and App admins may create a
  space deck (33a). Today any signed-in user can call `create-deck`, so
  this tightens it.
- **`canEditDeck(store, deck, handle, isAdmin)`**: becomes
  `canEditDeck(store, deck, me, org)`. It's false if
  `!sameOrg(deck, org)`. A personal deck can be edited by its owner only.
  Otherwise it's true for the owner, App admin, space admin (6a), or a
  teacher of a course in the space holding the deck (as today).
- **`my-decks`**: filter by `org`. Return the space's decks as today, and
  return the person's personal decks in a separate list, `personal: [...]`,
  so the client can draw the two shelves. A space admin gets every
  non-personal deck in the space (6a).
- **`attach-deck`**: refuse personal decks (`personal-deck`). A personal
  deck reaches a course only by being copied (see `copy-to-space` below).
- **`rename-deck`, `lock-deck`, `delete-deck`, `set-deck-parts`,
  `detach-deck`, `deck-cards`**: org check plus the new `canEditDeck`.
- **New `set-deck-practise`** `{ deckId, practise }`: owner of a personal
  deck only.
- **New `set-deck-numbers`** `{ deckId, from }`: stage 1 (46c). `from`
  must be a handle in the deck's space who has a number or time system in
  the deck's language. Personal decks: see question 73.

**Cards**

- **`save-card`**: stamp `org` on new cards. A card saved into only
  personal decks is `personal: true`. A personal card can't be saved into
  a space deck (refuse `personal-card`; copy instead). A space card *can*
  be added to a personal deck, but only one the person can see through a
  course they study (66b). That adds the card's id to the deck. It doesn't
  change the card's owner or `personal`, and needs no edit right on the
  card.
- **`mayEditCard`**: org check. A personal card can be edited by its owner
  only. Otherwise the same as the new `canEditDeck`.
- **`my-cards`**: filter by `org`. Return personal cards separately, as
  for decks.
- **`card-status`, `review-card`, `delete-card(s)`**: org check plus
  `mayEditCard`.
- **New `copy-to-space`** `{ deckId }`: owner of a personal deck who is a
  teacher in the space, a space admin or App admin (15a, 33a). It makes a
  new space deck (not personal) and new copies of every card in it that
  the person owns. Course cards the deck borrowed (66b) are referenced,
  not copied, because they're already space material. Recordings and
  pictures are shared by hash, so nothing is uploaded again. The client
  shows the 15a warning before calling it: "The copy and the original
  won't stay in sync."

**Numbers, clock and blank-fillers**

- One account = one space, so `mySystems:<handle>` is already "per teacher
  per space" (39a). No key change is needed.
- **Which systems reach a learner** (`my-material`, the
  `teacherHandles`/`systemsOf` part, around the comment "Whose values can
  reach this person"): today every deck owner's and every course teacher's
  systems are sent, and the device files **every** system into **every**
  deck of that language that holds number parts (`fileIntoDecks` in
  `src/numbers/generate.ts`, called from `src/shared.tsx`). Stage 1 changes
  this. Each deck with `parts` names one source (`numbersFrom` or its
  owner). `teacherHandles` must include every deck's `numbersFrom`, so the
  chosen teacher's system is sent even when they don't teach that course.
  The server stamps each deck it sends with `numbersSystemId` and
  `timeSystemId`: the chosen source's system ids for the deck's language,
  read from `systemIndex`. The client files a system only into the decks
  that name it: in `src/shared.tsx`, filter `holding` by
  `d.numbersSystemId === set.numbers.id`. Systems are still sent whole and
  unchanged, so the items a device already generated from a system (their
  ids come from the system's id; see `handOn` and `handOnSplit`) keep
  their progress. A deck with no source sends nothing, and its
  `partsWaiting` says so.
- `partsWaiting` (which number parts reach nobody yet) must read the
  deck's chosen source, not every teacher's.
- **Blank-fillers** are cards, so they follow the card rules: a sentence
  in a space deck is filled only from non-personal cards in the same
  space, and a sentence in a personal deck from the owner's cards
  (personal or not) in that space. The fill pass is wherever `fillsOf` and
  `fillsRev` are used in `courses.js`. Filter by `orgOf` and `personal`
  there.

**Reports**

- **`my-reports`**: today App admin only (since 0.412). Becomes App admin
  (all, or filtered to `x-org`) or space admin (their space only, 7a).
- **`dismiss-reports`, `admin-delete-flags`**: same gate.

**Media**

- `put-clip`, `put-image`, `clip`, `image`, `media-sizes` are addressed by
  the content's SHA-256 and shared across the whole site. Leave them that
  way. A hash can't be guessed, and sharing means a copied deck costs no
  storage. Storage per space (60a) is worked out by walking the space's
  cards (`clipsOfCard`) and pictures and adding up `media-sizes`. A file
  used by two spaces counts in both, and the screen says so.

**Admin actions** (`action.startsWith("admin-")` today requires
`me.admin`). Replace that gate with a table:

| action | App admin | space admin (own space) |
|---|---|---|
| `admin-overview` | yes (all spaces, or `x-org`) | yes, filtered to their space, personal records excluded |
| `admin-create-user` | yes | yes; the new user's `org` is theirs; never `admin`; the course must be in their space |
| `admin-reissue-key` | yes | yes for people in their space; see question 70 for other space admins; never for an App admin |
| `admin-rename-course`, `admin-course-language`, `admin-new-code`, `admin-card` | yes | yes, in their space |
| `admin-delete-flags` | yes | yes, their space's flags |
| `admin-delete-user`, `admin-delete-course` | yes | **no** (4b, 64a) |
| `admin-backup-manifest/chunk`, `admin-restore-chunk`, `admin-clear` | yes | **no** |
| new `admin-suspend-user` / `admin-reactivate-user` | yes | yes, their space; see question 70 |
| new `admin-new-invite` (replace the space's invite code) | yes | yes |
| new `admin-create-org`, `admin-update-org`, `admin-org-admins`, `admin-archive-org`, `admin-reopen-org`, `admin-export-org-*`, `admin-org-usage`, `admin-move-course` | yes | **no** |

`admin-clear` must also leave `org:`, `slug:` and `index:orgs` alone
unless it is clearing everything, and must recreate `org:main` after a
full clear. **`admin-restore-chunk`'s `allowed` prefix list** (the regex
starting `^(user|key|course|…`) must gain `org` and `slug` in the same
release that starts writing them. The comment above it says so. Add both
kinds to the backup manifest too (`admin-backup-manifest`, and
`BACKUP_PARTS` in `src/spaces.tsx`).

## B5. New actions

- **`org-info`** (no sign-in needed) `?slug=`: answers
  `{ ok, org: { id, slug, name, logo, colour, closed } }` for a current
  slug, `{ ok, moved: newSlug }` for a former one (8b), and
  `{ error: "no-space" }` otherwise. It never reveals people or material.
  It is the only new action that can be called without a key, so put it
  before the `currentUser` check, next to `signup`.
- **`key-saved`**: sets `keySaved: true` on the caller (19b).
- **`leave-space`**: see `delete-account` above.
- **`admin-create-org`** `{ name, slug, logo, colour, adminName }`: makes
  the org, the `slug:` record and an invite code. In the same request it
  creates the first space admin's account in the new space (65a), the way
  `admin-create-user` does, and returns that account's key once.
- **`admin-update-org`** `{ id, name?, slug?, logo?, colour? }`: changing
  `slug` pushes the old one onto `formerSlugs` and keeps its `slug:`
  record pointing at this org (8b).
- **`admin-org-admins`** `{ id, add?: handle, remove?: handle }`: the
  handle must be an account in that space (36a).
- **`admin-archive-org` / `admin-reopen-org`** (22a). "main" can't be
  archived.
- **`admin-export-org-manifest` / `admin-export-org-chunk`**: the backup
  machinery limited to one org's keys. Personal records are left out or
  kept depending on question 72. **No restore of a single space** in this
  plan. A space file is for keeping, and restoring one is a later piece of
  work.
- **`admin-org-usage`**: counts of people, courses, decks and cards, plus
  storage per org (60a).
- **`admin-move-course`** `{ courseId, toOrg, people: { [handle]: "move" | "stay" } }`
  (stage 6, pending questions 76–78). It refuses when any deck of the
  course is also in a course staying behind (41b). Moved people get
  `org = toOrg` and are taken off every course left in "main" (40b). The
  course, its decks and their cards get `org = toOrg`. Their progress
  needs no change, because progress lives in the person's own sync
  document, keyed by card id.

## B6. Addresses in the browser

- The server already answers any path that isn't a file with
  `index.html` (`server/index.js`). The service worker's
  `navigateFallback` does the same offline (`vite.config.js`), and assets
  are referenced from `/` (`base: "/"`). So `/lingua-academy` loads the
  app with no server change. Check that a deep path like
  `/lingua-academy/` (trailing slash) still loads its assets.
- **Read the address once at start-up** (`src/main.tsx` or the top of
  `ArabicTrainer`): `slug = location.pathname.split("/")[1] || ""`.
- **Not signed in:** call `org-info`. A current slug shows `Onboarding`
  (`src/spaces.tsx`) with the space's logo and name in place of the
  ManyTongues logo and title, and its colour as the accent on that screen
  only (29a). A former slug calls
  `history.replaceState(null, "", "/" + moved)` and reloads `org-info`. An
  unknown slug shows `Onboarding` with a `Notice`: "There's no space at
  this address." and a link to `/`. On the plain home page, `Onboarding`
  offers sign-in, plus "Set up" behind a code field (24b).
- **An invite link** is `/<slug>?join=<code>`. `Onboarding` reads `join`,
  pre-fills the code, and goes straight to the "new" step.
- **Signed in:** after `whoami`, if the address's slug isn't the
  account's, call
  `history.replaceState(null, "", "/" + account.org.slug + location.search)`.
  Exception: **App admins** stay at the address they opened (35a).
  **Pending question 82:** a signed-in person who follows *another*
  space's invite link (`?join=`) must not be silently moved to their own
  space and lose the invite. What they see instead depends on the answer. Every
  `courses-api.ts` call then sends `x-org` with the id of that address's
  space (add it in `call()`, next to `x-key`). For an App admin on the
  plain home page, use their own space.
- **Wrong address while not signed in (53b):** `Onboarding` sends
  `body.org` with `signin` and `signup`. On `other-space` it shows the
  message: "This key belongs to the space {name}." with two buttons,
  "Go to {name}" (link to `/<slug>`) and "Make a new account here" (goes
  to the "new" step). It uses `Notice` and `Button`.
- **Stored account:** the account stays in `localStorage["arabic-account"]`
  (`loadAccount`/`saveAccount` in `src/courses-api.ts`). It now also
  carries `org`. All spaces share the one origin, so one device holds one
  signed-in account at a time. Switching accounts is sign out, then sign
  in.
- **Installed app:** `start_url` is `"."` relative to the manifest at the
  root, so the installed app opens at `/`, then moves to the account's
  space. Nothing to change.

## B7. Screens, stage by stage

**Stage 1 — numbers by choice (46c).** On a deck's screen in Teaching (the
"This deck" block in `src/spaces.tsx`, next to the Courses field), when
the deck holds number parts, add a `Field` labelled "Numbers from" with a
`RadioGroup` of the teachers in the space who have numbers in the deck's
language. The owner comes first and is chosen by default when they have
numbers. With no candidates, show the existing `partsWaiting` nudge.
Tests: a course with two teachers who both have numbers gives each number
once, from the chosen teacher. Changing the choice moves the deck's
students onto the other set.

**Stage 2 — spaces underneath.** No screen changes. Server only (B2–B4),
plus `x-org` in `call()`. Tests: a new `tests/spaces.test.mjs` built like
`tests/server.test.mjs` (a real server on a temp `DATA_DIR`). Write a
second org's records straight into the store, then for **every** action
in the `action ===` list, assert that a user of one org can't read or
change the other's course, deck, card, system or flag. Assert that every
list leaves the other org out, and that an App admin with `x-org` can.
Add one test that fails if a new `action === "…"` appears in
`courses.js` without being listed in the test's table. That stops a later
action from being added without its org check.

**Stage 3 — creating spaces and addresses.**
- Admin gets a **Spaces** tab (`["orgs", "Spaces", <an existing icon>]` in
  `AdminSpace`'s `tabs`), App admins only. Its list is an `ItemList` of
  spaces (name, address, people count, storage, "Closed" when archived).
  A space opens into a `Section` with `Field`s for name, address, logo
  (the card editor's picture picker, reused), colour (an `<input
  type="color">` inside a `Field`, as plain as the app's other inputs),
  space admins (the existing people list pattern), archive/reopen behind
  `ConfirmModal`, and later export and usage. "New space" asks for the
  name, address and the first space admin's name, then shows the new key
  the way `admin-create-user` does today.
- The You menu (`CornerMenu` in `src/ArabicTrainer.tsx`): at the very top,
  above the Learning/Teaching/Admin picker, show the space's logo and name
  (read-only, no switching). The logo is **not** shown on the bar's
  button (owner's correction to 28a).
- The address handling in B6.

**Stage 4 — space admins.**
- `AdminSpace` shows for App admins and space admins
  (`account.admin || account.orgAdmin`). For space admins, hide the
  "App" tab (backup, restore, clear) and the delete actions. People gets a
  "Former members" `Section` under the current list: name, joined, left,
  courses, left or removed, and a "Reactivate" `Button`. Each person row
  gains "Suspend" (`ConfirmModal`). The space's invite link sits at the
  top of People: a read-only field with Copy and "Replace link"
  (`ConfirmModal`: "The old link will stop working.").
- Reports (Flags tab) go to space admins (7a).
- `AccountPanel` (`src/ArabicTrainer.tsx`): the "Delete account" control
  becomes "Leave this space" (question 68), with the 52a warning. The
  sign-in key's text changes from "your administrator can issue a new
  one" to "your space's admin can issue a new one".
- The key reminder (18a, 19b): `Onboarding`'s existing "key" step ("Keep
  this somewhere safe", with an "I've saved it" button) gains a sentence
  recommending a password manager, and a tick box ("I've saved my key
  somewhere safe") that enables the button. On that button, call
  `key-saved`. The same step is shown after a **sign-in** when the
  answer says `keySaved: false`, which covers accounts someone else made.
- Lost key, on `Onboarding`'s "existing" step: `Help` text reading "Lost
  your key? Ask your space's admin for a new one. Everyone else:
  {contact address}" (34c, question 75).

**Stage 5 — My space.**
- **Teachers:** in `TeachSpace`, the Decks and Cards tabs get a
  `Segmented` at the top: "Space" | "My space". "My space" lists the
  person's personal decks and cards, and "New deck" there makes a personal
  deck.
- **Learners:** the You menu's mode picker (`PlacePicker`) gains
  "My space" for people who don't teach (58a). It opens `TeachSpace` with
  a `personalOnly` prop: no Courses tab, only the "My space" side of
  Decks and Cards. Learners don't see the `Segmented`.
- **A personal deck's screen:** in place of the "Courses" `Field`, a
  `Field` labelled "Practise this myself" with a single checkbox (the
  existing `CheckList` with one option, or the plain checkbox pattern used
  in `card-editor.tsx`). Its lede: "Its published cards are in your
  Learning." In the deck list, a deck not practised shows the existing
  `TileNote` "Not practised" (59b, 61a). A teacher's personal deck also
  shows "Copy to the space" (`ConfirmModal` with the 15a warning).
- **Adding course cards to a personal deck (66b):** the deck's "Manage
  cards" picker offers the person's own cards and the cards of courses
  they study, each with a small note saying which course it came from.
- **Learning:** the pseudo-course "My space" from `my-material` appears in
  `StudentCourses` and wherever courses group decks. It has no leave
  control and no code. The report button is hidden on a card that's
  personal and in no course.

**Stage 6 — your extras.** Export a space, usage per space, and
moving a course (pending 76–78). The move screen is a `Section` in the
space's page: pick the course, pick the target space, then a `RadioGroup`
per person with "Goes with the course" and "Stays in main". It's refused
with an explanation when 41b applies.

## B8. Pitfalls

- **A list that forgets the org filter is a leak.** Everything that reads
  `index:courses`, `index:decks`, `index:users` or `index:flags` must
  filter by org. That includes `everyCourse`, `withLinks`,
  `partsWaiting`, `systemKeysOf`, `wipeAccount`, `admin-overview`,
  `my-*`, and the export plan (`exportable`). The stage-2 test exists to
  catch this.
- **`canEditDeck` is called from many places** (rename, lock, delete,
  parts, attach, report checks, `mayEditCard`). Change its signature
  once, and let the type checker find every caller.
- **`wipeAccount` (App admin delete)** removes a person's decks and cards.
  A personal deck holding borrowed course cards must not delete those
  cards; it removes only the deck and the person's own cards.
- **Codes** (`K.code`) are one site-wide namespace: course codes, teacher
  codes and now space invite codes. `codeTarget` has to tell them apart.
  The fallback scan in `courseForCode` (for restored backups) must also
  scan orgs' `inviteCode`.
- **Sessions remember where a card came from** (`courseId` and `deckId`
  on reports). The pseudo-course id `my-space` must never be sent to the
  server as a real course id.
- **Space admins aren't App admins.** Never set `admin: true` for them.
  Everything that checks `me.admin` today must be read again and decided:
  App admin only, or space admin too (table in B4).
- **Rename `SIGNUP_CODE` handling** carefully (question 74). The client
  only asks for that code after the server has said it's needed.

## B9. What to tell the owner at each hand-over

What changed for people, what to try by hand on the deployed app, and
anything still to decide, in plain terms (CLAUDE.md). For stage 2 the
answer is "nothing visible; here is how we know nothing leaks".
