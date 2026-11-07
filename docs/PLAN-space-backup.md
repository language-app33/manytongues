# Plan: a space's backup, and a restore that cannot lose anything

**Status: settled, not started.** Written from the owner's answers to
questions 1–20 in the conversation of 7 November 2026 and a reading of
the repository at 0.582. No questions are open. Anything new that comes
up while building goes back to the owner, in the way `CLAUDE.md`
describes, before it is decided.

Part A is for the owner, in plain terms. Part B holds the build notes for
whoever implements it, and is written for a model less capable than the
one that wrote it: it names files, functions and the exact places to
change, and it says in so many words what must never be done. It follows
`docs/PLAN-spaces.md` and `docs/PLAN-memberships.md` and uses their words
(`org` for a space in code, App admin for the super admin, space admin,
acting org, membership).

**The one rule above every other in this plan: preventing data loss comes
first.** A restore adds what is missing and changes nothing that is
already on the site, except the one thing the owner ticks by name. Where
the implementer is unsure what a rule means for a record, the record is
left alone and the fact is reported, never written.

---

# Part A — for the owner

## A1. What this is

Today, in Super admin → Spaces, each space has **Export this space**: one
file holding the space's people, courses, decks, cards, reports,
recordings and pictures. It leaves out everyone's My space and everyone's
practice, and there is no way to put a space back from it. The site's
whole-site **Back up / Restore / Verify** live in Super admin → App.

After this:

- **Each space can be backed up**, from Super admin → Spaces, as one file
  that holds the whole space: its people, courses, decks, cards, reports,
  recordings and pictures, **members' My space material in that space,
  and every member's practice**. The whole-site backup gains people's
  practice too.
- **A space can be put back from its file**, into the same site, whether
  the space still exists (something was lost or deleted inside it) or was
  deleted whole. The whole-site restore is rebuilt on the same engine and
  the same rules.
- **Restoring never overwrites and never removes.** It adds what the file
  holds and the site lacks. Before anything is written, a preview says, by
  name, what will happen to every person in the file and what will be
  added, and the screen says plainly that nothing on the site will be
  changed or lost.

## A2. What is wrong today

Nothing marks a space's file as one space's, so Restore a backup accepts
it today and writes every account in it back exactly as the file had it.
For someone who is in several spaces, that sets their whole account back
to the day of the file:

- a space they joined since the file would vanish from their account;
- a space they left, or were removed from, since would come back;
- a sign-in key you replaced since (say, because the old one leaked) would
  work again, and so would the new one;
- an account you deleted since would come back, key and all;
- a suspension across the whole app, applied since, would be lifted;
- a space's Former members list, and each teacher's list of number systems,
  would be set back to the file's, dropping entries made since.

The same restore also writes every card, deck and course back over the
site's copy, so an edit made since the backup is lost without a word.
This plan ends all of that.

## A3. The decisions

The number after each decision is the question it was settled in.

**What a backup is**

- **One feature, not two (1a).** Export this space becomes **Back up this
  space**, with a matching **Restore this space from a file** beside it.
  There is no separate export.
- **My space goes in (2a).** A space's file holds its members' private
  decks and cards made in that space. This reverses the earlier decision
  (72a of the spaces plan) because a space put back without them would
  lose people's own work. The file is still the App admin's alone to take
  and keep.
- **People's practice goes in (3), in both kinds of backup**, as a part of
  its own called **Progress**: each person's practice document, and the
  leftover audio a document may still name (18a: recordings learners made
  on cards of their own before 0.404; nothing makes new ones). A person in
  several spaces has one document across all of them; a space's file holds
  it whole (17a), and putting it back folds it into whatever practice they
  have by then (16a), with the same rule two of their devices use when
  they meet, so nothing practised since is lost. Doing it twice changes
  nothing.
- **The same choice of parts as the site backup (4a):** everything by
  default, or less (without recordings, say). Progress is one of the
  parts.
- **The App admin only (5a).** Space admins see none of this.

**Putting a space back**

- **Into the same site only (6a).** Moving a space to another server is
  not in this plan; it is noted in the backlog with what it would need.
- **Add, never overwrite (7a).** A record already on the site is left
  exactly as it is. A record the site lacks is written from the file.
  Lists that are naturally "the union of what both have" are joined: a
  deck that exists gains the file's cards it lacks; a course that exists
  gains the file's decks it lacks; a person's list of their own cards
  gains the file's; a space's Former members list gains entries it lacks;
  a teacher's map of number systems gains systems it lacks. Nothing is
  taken out of anything. The screens say so before the button.
- **Where (8a).** Restore this space from a file is on each space in Super
  admin → Spaces, and a **Restore a space from a file** at the top of that
  list is for a space that no longer exists. Super admin → App's Restore a
  backup takes whole-site files only; handed a space's file, it says
  whose it is and points to Spaces.
- **A preview before anything is written (9a), for both kinds of file.**
  It names the people the restore will leave as they are, will not put
  back into the space, will re-create, and will leave deleted (with a tick
  box to bring each back), the rosters it will trim, the spaces it will
  re-create or finds in the way, and how many cards, decks and courses it
  will add against how many are already there.
- **The space's own card (10).** When the space still exists, the preview
  offers a choice, with **Keep the space's current name, address, look and
  admins** ticked by default; the other choice takes the file's name, logo,
  colour and admins (never its address, and never its join codes). When
  the space is being re-created, the file's card is used, and if its
  address has since been taken by another space the preview asks for a new
  address before it will go on.

**People — where the damage would be**

- **An account that exists and is in the space is not touched at all
  (11a).** Not its key, its name, its other spaces, its suspensions, nor
  when it was last seen. Only material comes back.
- **Someone who has left the space, or was removed, since the file is not
  put back into it (12a).** The preview names them so you can add them
  from People if you mean to. Their material in the space still comes
  back, under their name, as a former member's does.
- **An account that no longer exists is re-created (13a)** with the spaces
  the file is about as its only spaces, and its old key working, **unless
  the site holds a deletion record for that handle**, which means the
  account was deleted on purpose since the file. Then it stays deleted by
  default, and the preview lets you tick it to bring back anyway (20a).
  Deleting a whole space wipes those records with it, so restoring a
  deleted space re-creates its people.
- **A restored course's roster is trimmed to people who are in the space
  (14a)**, and the preview says whose names come off. A course that still
  exists keeps the roster it has.
- **A handle that now belongs to a different person** (possible only after
  a whole space was deleted and the name reused) stops the whole restore
  before anything is written, with the names. Material cannot be given to
  the wrong person.

## A4. What changes for the people using the app

Nothing, for learners, teachers and space admins. Everything here is in
Super admin.

For the App admin:

- Super admin → Spaces: each space's **Export this space** is now **Back up
  this space**, opening the same choice of parts as the site backup, and
  beside it **Restore this space from a file**. At the top of the list,
  **Restore a space from a file**, for a space that is gone. The storage
  line now counts My space material and says so.
- Super admin → App: **Back up the site** has a new part, Progress, ticked
  by default. **Restore a backup** goes through the same preview. The help
  no longer says progress is not in the file.
- Every restore screen and its confirmation says: *Nothing on the site is
  overwritten or removed. This adds what the file holds and the site
  lacks.* Afterwards it reports what was added, what was folded in, and
  everything it left alone and why, person by person.

## A5. What it costs

- **A backup is larger.** Progress documents are up to a few megabytes
  each; the Progress part can be left out when size matters.
- **A restore cannot repair a record that exists but is wrong**, because
  it never overwrites. The way to put a card back as it was is to delete
  that card and restore; the way to put a whole space back as it was is to
  delete the space and restore. Both are the owner's deliberate acts.
- **Old space files** (made before this release) carry no mark saying
  which space they are. They are taken as whole-site files and restored
  from Super admin → App, through the same engine and the same rules, so
  they are safe; only the space-card choice is not offered for them.
- **Taking a backup reads every member's practice document** to learn
  which audio it names, as it already reads every card for its
  recordings. On a teaching site this is a few seconds.
- **Clear data** gains Progress too, because the parts list is one list
  read by backup, restore, verify and clear alike. It still needs the
  deploy's admin key, and it is the only thing on the site that removes
  practice.

## A6. How it will be checked

By the test suite, run by `npm run check`, with new tests for every rule
in A3 (listed in B8). By hand, on the deployed site:

1. Back up a space that has a member whose first space is Main and who has
   practised; open the file in Verify: "complete", with Progress in it.
2. In that space, delete one card, take one card out of a deck, and remove
   one student from the space. Restore the space's file. Preview names the
   removed student under "not put back". After: the card is back, the deck
   has its card again, the student is still out, and nothing else moved.
3. Give that member a new key, then restore again. They sign in with the
   new key only; the old one is refused.
4. Delete a member's account from Super admin → People, restore: the
   preview lists them under "deleted since the backup", unticked. Tick
   them, restore: they are back, in this space only, with their old key.
5. Practise on a device, restore an older file of the same space: the
   device's newer practice and the file's older practice are both there.
6. Delete the whole space and restore it from its file: it is back, its
   people re-created with their keys, their practice and My space back.
7. Restore the same file a second time: the report says nothing was added.
8. Open a space's file in Super admin → App → Restore a backup: it is
   refused with the space's name. Open a site file in Spaces → Restore a
   space: refused likewise.
9. Take a whole-site backup, Clear data (all parts), restore it: everyone,
   everything and all practice are back; the acting admin's own key still
   works.

---

# Part B — build notes

## B0. Read this first

1. **Never delete and never overwrite in a restore.** The only deletion
   this plan allows is the `gone:<handle>` record of an account the owner
   ticked to bring back (B5.3). The only overwrite is a space's name, logo,
   colour and admins when the owner unticks "keep" (B5.3). Every other
   write is *create if absent* or *add to a list*. If a rule below seems
   to ask for anything else, it does not; ask the owner.
2. **Nothing is skipped in silence.** Every record a restore does not write
   is counted and reported with a reason (B5.6). The comment above the
   current `allowed` regex in `admin-restore-chunk` says why: a prefix
   missing from the list made `written` under-report and the restore say
   it worked.
3. **One engine, two doors.** The whole-site restore and the space restore
   use the same server code and the same client code, with one `scope`
   option. Do not write a second restore.
4. **Preview and restore cannot disagree**, because the restore decides
   each record from the site's state at write time with the same function
   the preview used; the client passes only the owner's choices
   (`bringBack`, `keepSpaceCard`, `newSlug`, `scope`), never verdicts.
5. **Build in the stage order below**, with `npm run check` green at the
   end of each stage, and commit each stage. Stages 1 and 2 ship nothing
   dangerous and can go to `beta` on their own; stage 3 onward go
   together, because a preview without the new engine would describe a
   restore that does not yet behave that way.
6. **Every new server action goes into `PLACED` in
   `tests/spaces.test.mjs`** (the `site` list), or that test fails.
7. **Release work is part of the job**: bump `package.json`, write the
   `CHANGELOG.md` entry in the terms of A4/A5, update `README.md` (the
   Spaces section's "A space's export and storage" paragraph, and the
   "Notes on the data" line that says progress is not in backups), and add
   a `DECISIONS.md` entry for "a restore never overwrites" and one for
   "deleted on purpose means a deletion record exists". Then follow
   `CLAUDE.md` to `beta`.
8. **Do not touch** `wipeAccount`, `addMembership`, `removeMembership`,
   the sync endpoint's GET/POST behaviour, `moveSyncDoc`, `forgetSyncDoc`
   (other than extracting the helper in B3.1), or any membership rule.
   They are the subject of the risks this plan prevents, not the tools.

## B1. Where things are today

- **Server:** everything is in `server/api/courses.js`. The backup block
  starts at the comment `================= backup =================`
  (around line 5154): `admin-backup-manifest`, `admin-export-org-manifest`
  and `admin-org-usage` share one handler; `admin-backup-chunk` reads the
  keys a chunk names; `admin-restore-chunk` writes records. `admin-clear`
  follows. All are App-admin only through the `iAmAdmin` gate above
  `SPACE_ADMIN_MAY` (around line 5013); `admin-clear` also demands the
  deploy's `ADMIN_KEY`.
- **Storage keys** are built by `K` (around line 415): `user:`, `key:`,
  `course:`, `deck:`, `card:`, `mycards:`, `owncards:` (legacy), `numsys:`,
  `timesys:`, `mysystems:`, `flag:`, `clip:`, `image:`, `code:`, `index:`,
  `org:`, `slug:`, `former:`, `gone:`. Helpers: `readJson`, `writeJson`,
  `updateJson` (read-modify-write under the store's own lock; return
  `null` from the change function to write nothing), `readIndex`,
  `readManyJson`, `sha`. Membership readers: `memberOf(user)`,
  `suspensionIn(user, org)`, `normalisedUser(user)`, `orgOf(rec)`,
  `inScope(rec)`.
- **Practice documents** live in a *different store*, `arabic-trainer`,
  in `server/api/sync.js`: the document under `keyFor(token)` and each
  audio clip under `keyFor(`${token}:audio:${id}`)`, where `token` is the
  SHA-256 hex of the sign-in key, which is exactly the `keyHash` the
  courses store keeps on `user:<handle>`. `forgetSyncDoc(token)` and
  `moveSyncDoc(old, new)` already read a document's audio ids the same
  way; `src/sync.ts` exports `mergeData(local, remote, now)`, pure, which
  the server may import as it imports `../../src/cards.ts` and the rest.
  The document is capped at `MAX_BYTES` (4 MB) by the sync endpoint.
- **Client:** `src/spaces.tsx`. `BACKUP_PARTS` (around line 972) is the
  one list of parts; `buildBackup`, `writeFile`, `restoreBackup`,
  `verifyBackup` follow it. `BackupScreen` (around line 3338) is the
  download/restore screen; the restore's confirm and call are in
  `AdminSpace` where `onRestore` is passed to it (around line 3178).
  `SpaceExtras` (around line 9800) draws a space's storage line and Export
  this space; `SpacesTab` (around line 9285) is Super admin → Spaces. API
  calls are in `src/courses-api.ts` (`backupManifest`, `backupChunk`,
  `restoreChunk`, `exportOrgManifest`, `orgUsage`, around lines 513 and
  546).
- **The file format:** `{"format":"language-app-backup","manifest":{…},
  "records":{key: value…},"digests":{…}}`. The manifest carries
  `version: 1`, `takenAt`, `counts`, `indexes`, `chunks`, `plan` (dropped
  from the file) and, since 0.462, `includes` (the parts). Records are
  stored verbatim; `clip:`/`image:` values are text, the rest JSON.
- **Chunk order** is the manifest's order: user, keymap, course, deck,
  owncards, card, system, mysystems, flag, org, former, gone, slug, clip,
  image. `restoreBackup` sends records in file order, in requests under 3
  MB and 200 records, and the indexes last. This order matters in B5:
  users are on the site before keys, courses and progress are written.
- **Tests:** `tests/server.test.mjs` (backup of flags around line 2423,
  numbers around line 3094), `tests/audit-0580.test.mjs` (a full backup
  keeps a deleted teacher's cards; a space's export keeps a second-space
  member), `tests/spaces.test.mjs` (`PLACED`, and a space-admin is refused
  the site actions). `tests/helpers.mjs` has `api()`, `classroom()`,
  `raw()`, `store`.

## B2. Stage 1 — a file that knows what it is, and holds My space

Release: no user-visible change beyond the storage line; may ship alone.

1. **Mark the manifest.** In the shared manifest handler, add to the
   manifest `scope: only ? { kind: "space", space: only, slug: <org slug>,
   name: <org name> } : { kind: "site" }`. Read the org document you
   already read into `orgDocs` for the slug and name. `buildBackup` keeps
   it (it spreads `whole`). `includedIn`/`verifyBackup` ignore it.
2. **My space in a space's file.** The `keep` test is
   `orgOf(rec) === only && !rec.personal` and `keepMember` ends the same
   way. Drop `&& !rec.personal` from both. Personal decks and cards carry
   `org` (`personal: true` is set beside it in `create-deck` and
   `save-card`), so the space test alone keeps them to the space. The
   whole-site branch (`only === ""`) already returns ids unfiltered and so
   already held My space. Update the comment above the handler and the
   `SpaceExtras` help ("including everyone's My space here").
3. **Usage counts follow.** `admin-org-usage` reuses the same lists, so it
   now counts My space material. Say so in its help line.
4. **Rename the button** in `SpaceExtras` from "Export this space" to
   "Back up this space" and make it open `BackupScreen` in `download`
   mode (the parts choice, 4a) with `source: () => API.exportOrgManifest(
   org.id)` passed through to `buildBackup`. Today the button calls
   `buildBackup` directly with `ALL_PARTS`; keep that code path as what the
   screen's Download does. The file name stays `space-<slug>-<stamp>.json`.
   `BackupScreen` is drawn inside `AdminSpace`'s App tab today; lift the
   state it needs (`backupMode`, `backup`, `restoreFile`) into a small
   hook or component so `SpaceExtras` and the App tab share it rather than
   copy it — one implementation, per `README.md`.
5. **Tests.** Extend the A3 test in `tests/audit-0580.test.mjs`: a
   personal deck and card made in space B by the visiting teacher are in
   B's plan; a personal deck made in Main by the same teacher is not.
   Assert `manifest.scope.space === B` and that the site manifest has
   `scope.kind === "site"`.

## B3. Stage 2 — people's practice in every backup

Release: "Backups now include people's practice." May ship alone.

1. **Helpers in `server/api/sync.js`.** Extract the audio-id walk that
   `forgetSyncDoc` and `moveSyncDoc` both contain into one exported
   `recordingIdsOf(doc)` (returns the valid ids, deduplicated), and use it
   in both. Add and export:
   - `readSyncDoc(token)` → the document's text or `null` (validate the
     token with the same hex test the others use);
   - `readSyncAudio(token, id)` → text or `null`;
   - `writeSyncAudioIfAbsent(token, id, text)` → `store.set(..., {
     onlyIfNew: true })`, returning whether it wrote;
   - `mergeSyncDoc(token, incomingText, now)`: reads the current text; if
     none, writes `incomingText` with `onlyIfNew` and returns
     `{ outcome: "written" }`; if the current text does not parse, returns
     `{ outcome: "skipped", why: "unreadable" }` and writes nothing (the
     GET endpoint has its own recovery for that document; a restore must
     not paper over it); otherwise writes
     `JSON.stringify(mergeData(current, incoming, now))` with
     `onlyIfMatch` on the current ETag (retry once on a refused write, by
     re-reading; a device may have synced in between) and returns
     `{ outcome: "merged" }`. If the merged text exceeds `MAX_BYTES`,
     return `{ outcome: "skipped", why: "too-large" }`. Import `mergeData`
     from `../../src/sync.ts`; it is pure (see `tests/sync.test.mjs`,
     which runs it in Node).
2. **Manifest.** After `users` are read (the `keyHashes` line), for each
   user with a `keyHash`, read their document with `readSyncDoc`. Keep two
   lists: `progressHandles` (handles whose document exists) and
   `practiceAudio` (`{ handle, id }` for each id `recordingIdsOf` finds).
   Add `batch("progress", progressHandles.map((h) => `progress:${h}`), 1)`
   and `batch("paudio", practiceAudio.map((a) => `paudio:${a.handle}:${
   a.id}`), 3)`, placed after `gone` and before `slug`. Add
   `counts.progress = progressHandles.length` and
   `counts.practiceAudio = practiceAudio.length`. Keyed by **handle, not
   token**, on purpose: a person's token changes when they get a new key,
   and a restore must find their *current* document from their handle
   (B5.4). For a space's file the handles are its members (17a: the whole
   document). Former accounts have no document (deletion removes it), so
   `goneHandles` are not read.
3. **Chunks.** In `admin-backup-chunk`, keys starting `progress:` and
   `paudio:` are answered from the sync store: split the key, read
   `user:<handle>` for its `keyHash`, then `readSyncDoc` or
   `readSyncAudio`. A missing user or document is simply absent from
   `records`, as a missing key is today. Values are text, like clips.
4. **The part.** Add to `BACKUP_PARTS`, after "Reported problems" and
   before "Recordings and images":
   `{ key: "progress", title: "Progress", what: "Each person's practice:
   what they have answered and when it is next due, and any recordings
   they made on cards of their own. Put back by folding into whatever
   practice they have by then, never over it.", kinds: ["progress",
   "paudio"], prefixes: ["progress:", "paudio:"], count: "progress",
   unit: "person" }`. Add `"progress:": 0` to `counts` and
   `["progress", "progress:", kept.counts && kept.counts.progress]` to the
   `expect` lists in `writeFile` and `verifyBackup`.
5. **Restore (interim, before stage 3).** Add `progress|paudio` to the
   `allowed` regex and handle them in `admin-restore-chunk`: resolve the
   handle to the site's `user:<handle>`; no user → skip; `progress:` →
   `mergeSyncDoc(user.keyHash, text, Date.now())`; `paudio:` →
   `writeSyncAudioIfAbsent`. Raise the 4 MB payload cap for these two
   kinds to the sync endpoint's `MAX_BYTES` measured with
   `Buffer.byteLength`, and never silently: see B5.6. Stage 3 replaces the
   rest of the handler but keeps these two.
6. **Clear.** In `admin-clear`, `if (want.has("progress"))`: for every
   handle in `index:users`, read the user and call
   `forgetSyncDoc(user.keyHash)`; count them under `removed.progress`.
   The `ClearScreen` already offers every part.
7. **Microcopy.** In the App tab's Backup section replace the help
   "Students' own progress isn't in here…" with: "People's practice is in
   the Progress part. Putting it back folds it into whatever they have
   practised since; it never replaces it."
8. **Tests** (in `tests/server.test.mjs` or a new
   `tests/backup-progress.test.mjs`): a student syncs a document with one
   item and one audio clip; the site manifest's plan names
   `progress:<handle>` and `paudio:<handle>:<id>`; the chunk returns both;
   after `forgetSyncDoc`, restoring the two writes them back and a GET on
   the sync endpoint returns the item; restoring again over a document
   that has since gained a second item keeps both items; the ETag of the
   document after a third identical restore is unchanged. A space's
   manifest names the document of a member whose first space is Main.
   Clearing with `parts: ["progress"]` removes the document.

## B4. Stage 3 — the verdicts: one function that decides about people

Everything in B4 and B5 lives in `server/api/courses.js` next to the
backup block, as module-level functions so the two actions share them.

1. **`restoreVerdicts(store, fileUsers, options)`** where `fileUsers` is
   `{ handle, created, keyHash, orgs, org }[]` taken from the file's
   `user:` records, and `options` is
   `{ scope: { kind: "site" } | { kind: "space", space }, bringBack:
   string[], fileOrgs: string[] }` (`fileOrgs` is the file's
   `manifest.indexes.orgs`). It returns `Map<handle, verdict>` with
   `verdict` one of:
   - `{ kind: "other-person" }` — the site has `user:<handle>` and both
     records carry `created` and they differ. (Two different people with
     one handle. Possible only after a whole space was deleted, which
     drops the `gone:` records that otherwise keep a handle from being
     reused.)
   - `{ kind: "kept" }` — the site has the account and, for a space scope,
     `memberOf(siteUser).includes(space)`. For a site scope, any existing
     account is `kept`. **Nothing of the account is written** (11a).
   - `{ kind: "not-member" }` — the site has the account but it is not in
     the space (left or removed since). Not written, not re-added (12a).
   - `{ kind: "deleted", at }` — no account, and `gone:<handle>` exists on
     the site, and the handle is not in `bringBack` (13a). `at` is the
     record's `at`, for the preview.
   - `{ kind: "recreate", orgs }` — no account and no `gone:` record, or
     the handle is in `bringBack` (20a). `orgs` is the trimmed membership:
     for a space scope `[space]`; for a site scope the file record's
     `memberOf()` filtered to spaces that exist on the site or are in
     `fileOrgs`. If that comes out empty, fall back to `fileOrgs[0]` for a
     site scope (an account with no space cannot sign in anywhere; the
     preview says so).
   Read the site once per handle (`readJson(store, K.user(h))`, then
   `K.gone(h)` only when there is no user).
2. **Why `created`.** It is set once when an account is made and carried
   unchanged into every backup and every re-creation, so two records of
   the same person agree on it and two people's differ. `keyHash` is not
   used for this: it changes with every new key.

## B5. Stage 3 — the engine: `admin-restore-chunk` rewritten

Keep the action name and the request shape (`body.records`), and add
`body.options` as in B4.1 plus `keepSpaceCard` (boolean, default `true`)
and `newSlug` (string, optional). The client sends the same `options`
with every request of one restore. Every rule below is "per record"; a
request may hold any mix of kinds, and the file's order (B1) guarantees
that users are on the site before anything that needs them.

1. **The shape of the handler.** Compute `verdicts` once per request for
   the `user:` records in it (B4.1). Then for each key in order, call
   `restoreOne(store, key, value, ctx)` which returns one of
   `{ outcome: "written" }`, `{ outcome: "merged" }` or
   `{ outcome: "skipped", why }`. Count outcomes, and collect
   `skipped: [{ key, why }]`, capped at 500 entries per response with a
   `skippedMore: n` count beyond that. Respond
   `{ ok: true, written, merged, skipped, skippedMore }`.
2. **People and keys.**
   - `user:<h>`: by verdict. `kept`, `not-member`, `deleted`,
     `other-person` → skipped with that `why`. `recreate` → write
     `normalisedUser(value)` with `orgs` set to the verdict's list, `org`
     to its first entry, `suspendedIn` reduced to those orgs, and
     `lastLearnedIn`/`lastTaughtIn` likewise. Keep `keyHash`, `admin`,
     `created`, `displayName`, `keySaved`, `suspendedApp`, `lastSeen`,
     `lastLearned`, `lastTaught` as the file has them. (Keeping a
     file's `suspendedApp` is the safe side: a suspension survives;
     lifting it is a tap in People.) When the handle was in `bringBack`
     and a `gone:<h>` record exists: delete it, take the handle off
     `index:gone`, and remove the handle's entry from `former:<org>` for
     each org in the verdict's list, as `addMembership` does on a
     reactivation. This is the one deletion in the engine (B0.1).
   - `key:<hash>` (value is a handle): write only when the site now has
     `user:<handle>` whose `keyHash === hash` **and** the record is absent
     or already equal. Otherwise skipped, `why: "key-changed"` when the
     account exists with another key (a replaced key must never work
     again), `why: "no-account"` when it does not exist. Because
     re-created accounts were written in an earlier chunk with the file's
     `keyHash`, their old key comes back; a `kept` account's key record
     is skipped whether or not it changed (if unchanged it is already
     there).
3. **Spaces.**
   - `org:<id>`: absent → write it, with one check first: if `slug:<its
     slug>` exists and names another org, then if `options.newSlug` passes
     `slugProblem` and is free, write the org with `slug: newSlug` and
     the old one appended to `formerSlugs`; otherwise skipped,
     `why: "slug-taken"`. Also write `slug:<slug>` → id for the slug used.
     Present → if `keepSpaceCard` (default) skipped, `why: "exists"`;
     else `updateJson` the record, changing only `name`, `logo`, `colour`
     and `admins`, where `admins` is the file's list filtered to handles
     that have an account on the site and are members of the org; never
     `slug`, `formerSlugs`, `inviteCode`, `closed` or anything else.
     Report `merged`.
   - `slug:<slug>`: absent → write; present and equal → skipped
     `"exists"`; present and different → skipped `"slug-taken"`.
   - `former:<org>`: `updateJson`: start from the site's list; add each
     file entry whose handle has no entry on the site **and** is not a
     current member of that org (an entry for a current member would list
     them under Former members). Report `merged` if anything was added,
     else skipped `"exists"`.
   - `gone:<h>`: write only when absent **and** the site has no
     `user:<h>`; add `h` to `index:gone` when written. Otherwise skipped.
4. **Material.**
   - `card:`, `flag:`, `numsys:`, `timesys:`, `clip:`, `image:`: write
     only when absent (`store.set(key, payload, { onlyIfNew: true })`,
     and treat `modified: false` as skipped `"exists"`). A card edited
     since the backup keeps its edit.
   - `deck:`: absent → write. Present → `updateJson` adding to `cardIds`
     any id in the file's `cardIds` it lacks (order: existing first, then
     the file's additions in the file's order); `merged` if anything was
     added. Nothing else on the deck changes.
   - `course:`: absent → write, after trimming: `teachers` and `students`
     filtered to handles whose site `user:` record exists and whose
     `memberOf()` includes `orgOf(course)` (14a; a member suspended in the
     space is still a member and stays). Then, as today, write `code:` for
     `code` and `teacherCode`, but only when the `code:` record is absent
     or already names this course; a code that now names another course
     is left, and the course keeps the field (the teacher gets a new code
     from the course page; say so in the report as skipped
     `"code-taken"` under a key `code:<code>`). Present → `updateJson`
     adding to `decks` any id the file has and the site lacks; `merged` if
     any. **Rosters of an existing course are not touched.**
   - `mycards:`, `owncards:`: union, as today. Report `merged` when the
     list grew, else skipped `"exists"`.
   - `mysystems:`: `updateJson`: for each of `numbers` and `times`, add
     the file's language → id entries the site's map lacks; keep the
     site's where both have one. `merged`/`"exists"`.
   - `progress:`, `paudio:`: as B3.5 (`mergeSyncDoc`,
     `writeSyncAudioIfAbsent`), resolving the handle to the **site's**
     user record so a person who has a new key since the file gets the
     file's practice folded into their current document. No account
     (verdict `deleted`, `not-member` with no account, or anything else
     without a `user:` record) → skipped `"no-account"`.
5. **Indexes** (`index:users`, `courses`, `decks`, `flags`, `orgs`,
   `gone`): union as today, **but only add an id whose record exists on
   the site now** (`store.has(K.user(id))` and so on, by index). An index
   must never name what is not there: that is how a `deleted` handle stays
   out of People. Report `merged` when the index grew.
6. **Nothing silent.** Replace the `allowed` regex's silent `continue`
   with skipped `"not-allowed"`; the size cap with skipped `"too-large"`
   (the cap for `progress:` is the sync endpoint's `MAX_BYTES`); a
   `store.set` that throws with skipped `"error"` and the message in the
   server log, continuing with the next record. The response's `written`
   now counts only true creates; the client shows all three numbers.
7. **Idempotence.** Running one file twice must leave every record's ETag
   unchanged on the second run. Every rule above is written to make that
   so; the test in B8 checks it on the whole store.

## B6. Stage 3 — `admin-restore-preview`

A new App-admin-only action, placed in `PLACED.site`. It writes nothing.

1. **Request:** `{ options, users: fileUsers, courses: [{ id, org,
   teachers, students }], orgs: [{ id, slug, name }], keys: { cards:
   string[], decks: string[], courses: string[], flags: string[] } }`,
   where the client takes `users`, `courses` and `orgs` from the file's
   records (only the fields named; never the whole records) and `keys`
   are the ids of the file's material. Reject a body over the server's
   limit as the server already does (`too-large`, 413); the client sends
   at most the ids, so a large site stays well under it.
2. **Answer:** `{ ok: true, people: { kept: [{ handle, displayName }],
   notMember: [...], deleted: [{ handle, displayName, at }], recreate:
   [{ handle, displayName, orgs }], otherPerson: [...] }, rosters:
   [{ course, title, dropped: [handle…] }], spaces: [{ id, name, slug,
   exists, slugTaken, takenBy }], material: { cards: { add, have },
   decks: { add, have }, courses: { add, have }, flags: { add, have } },
   blockers: string[] }`. `rosters` lists, for each course that does not
   exist on the site, the handles that trimming would drop (B5.4), using
   the verdicts (a `recreate` handle counts as a member-to-be). `spaces`
   uses the site's `org:` and `slug:` records. `material.have` counts ids
   whose record exists (`store.has`). `blockers` are plain sentences the
   client shows and that disable Restore: any `otherPerson`; any space
   with `slugTaken` while `options.newSlug` is missing or not free; a
   space-scoped file whose `scope.space` is not the space the screen was
   opened for.
3. **Verdicts come from B4.1**, with the same `options`, so the lists are
   exactly what the restore will do a moment later if nothing on the site
   changes in between; and if something does, the restore decides again
   from the site, never from the preview.

## B7. Stage 4 — the screens

All in `src/spaces.tsx` unless said; API functions in `src/courses-api.ts`
(`restorePreview(body)`, and `restoreChunk(records, options)`).

1. **`restoreBackup(file, onProgress, parts, options)`** passes `options`
   on every request and sums `written`, `merged`, `skipped` (concatenated,
   with `skippedMore`). It returns `{ written, merged, skipped,
   skippedMore }`. Keep indexes last.
2. **`BackupScreen` in restore mode gains a preview step.** After a file is
   chosen and verified, and parts are ticked, a button **Check what this
   will do** calls the preview with the options so far. Under it:
   - **People**, in four groups with counts and names: "Left as they are",
     "Not put back into this space" (space scope only; with the line "Add
     them from People if you mean to"), "Re-created, with their old key",
     and "Deleted since the backup — stays deleted" where each name has a
     tick box ("Bring back") that adds the handle to `bringBack`; ticking
     re-runs the preview, so the name moves to Re-created. "Belongs to
     someone else now" is shown in red and is a blocker.
   - **Rosters**: "These names come off restored courses because they are
     not in the space: …".
   - **Spaces**: "Will be re-created" / "Exists" with, when it exists, the
     choice from 10 as two radio rows, "Keep the space's current name,
     address, look and admins" (default) and "Take the file's name, logo,
     colour and admins (its address and codes stay as they are now)"; and
     when its address is taken, a text field "New address for it" with
     the blocker sentence until it is free (the field value goes in
     `options.newSlug`; re-run the preview on blur).
   - **Material**: "Adds N cards (M already here), …".
   - Above all of it, in a `Notice`, the standing sentence: **"Nothing on
     the site is overwritten or removed. This adds what the file holds and
     the site lacks."** Replace the current help that says records are
     "written back over whatever has the same name"; that sentence becomes
     false in this release, and so does the same one in the confirm dialog
     in `AdminSpace` — rewrite both.
   - Restore is disabled until a preview has run for the current choices
     and has no blockers. Any change (parts, tick boxes, radio, field)
     clears the preview.
3. **The report afterwards** (`backup.state === "restored"`): "Added N,
   folded in M, left alone K", then the skipped list grouped by reason in
   plain words — "already here", "key changed since", "not in this
   space", "deleted since the backup", "address taken", "code in use by
   another course", "too large", "not allowed" — with handles where the
   reason is about a person. Nothing is hidden behind a count alone.
4. **Two doors.** `BackupScreen` takes `scope`. In Super admin → Spaces,
   `SpaceExtras` has "Back up this space" (B2.4) and "Restore this space
   from a file" (scope `{ kind: "space", space: org.id }`); handed a file
   whose `manifest.scope` is a different space or the site, it says which
   and refuses. At the top of `SpacesTab`, beside "New space", "Restore a
   space from a file": it reads the file's `manifest.scope`, refuses
   anything but a space file, and opens the same screen with that space
   as scope (for a space that no longer exists, this is the only way in).
   In the App tab, Restore a backup refuses a file whose
   `manifest.scope.kind === "space"` with "This is a backup of the space
   *Name*. Restore it from Super admin → Spaces." A file with no `scope`
   (made before this release) is treated as a site file there.
5. **Microcopy elsewhere.** The App tab's backup help (B3.7); the Spaces
   storage line (B2.2); `BackupScreen`'s download help can stay. Follow
   `docs/UI-COMPONENTS.md` for `CheckList`, `Notice`, `Section`,
   `ConfirmModal`; add nothing new to the component library.

## B8. Tests to write

Server tests use `tests/helpers.mjs`. Put the new ones in
`tests/restore.test.mjs` so they can clear and restore freely, as
`tests/audit-0580.test.mjs` explains in its header. Each is one rule:

1. **Kept.** A member of two spaces: take B's file; then give them a new
   key, add them to a third space, suspend them app-wide. Restore B's
   file. Their `user:` record's ETag is unchanged; the old `key:` record
   is absent; the new key signs in; the old key is refused.
2. **Not a member.** Remove a student from B after the file; restore;
   `memberOf` still lacks B; the preview listed them under `notMember`;
   their cards in B are back on the site.
3. **Deleted stays deleted; bring back works.** Delete an account after
   the file; restore: no `user:` record, `index:users` lacks the handle,
   the preview lists them under `deleted`. Restore again with `bringBack:
   [handle]`: the account exists with `orgs: [B]` only, `gone:` is gone,
   `index:gone` lacks them, `former:B` lacks them, their old key signs in,
   and their document from the file is back under their keyHash.
4. **Re-created after a space deletion.** Delete space B whole; restore
   its file: the space, its people (with `orgs: [B]`), their keys, their
   My space decks and their practice are back; `other-person` is empty.
5. **Another person has the handle.** After deleting B, sign up a new
   account with a handle B's file holds; restore: the preview's
   `otherPerson` names it and the restore's chunk skips the record with
   that reason; nothing of the file's material is listed on the new
   person's `mycards:`.
6. **Rosters.** A restored (absent) course's roster lacks the removed
   student from test 2; an existing course's roster is untouched by a
   restore whose file names someone no longer on it.
7. **Material.** Edit a card after the file; restore; the edit stands.
   Empty a deck's `cardIds`; restore; the ids are back (this is what
   `tests/audit-0580.test.mjs` already does, so that test keeps passing
   under the new rules). A deck created after the file is still there.
8. **Former list and systems.** A Former members entry made after the
   file survives; a number system made after the file stays in
   `mysystems:`; the file's system that was deleted since is back. Update
   the `written: 2` assertion in `tests/server.test.mjs` (around line
   3140) to the new counts (`written` 1, `merged` 1).
9. **Space card.** With `keepSpaceCard` unset, a renamed space keeps its
   name; with it `false`, the file's name comes back and the address does
   not change. With the file's address now taken by another space and no
   `newSlug`, the preview blocks and the chunk skips `"slug-taken"`; with
   a free `newSlug`, the org is written under it.
10. **Indexes never name the missing.** After test 3's first restore,
    `index:users` lacks the deleted handle even though the file's
    `index:users` carried it.
11. **Nothing silent.** A record with an unknown prefix and one over the
    cap come back in `skipped` with their reasons, and
    `written + merged + skipped.length === keys sent`.
12. **Twice is a no-op.** Restore a whole site file into a site that
    already has everything; every record's ETag in both stores is the
    same before and after (walk the data directory). Then restore the same
    file again after test 4's deletion; the second run of it changes no
    ETag either.
13. **Preview equals restore.** For the scenario in test 3, the preview's
    lists equal the handles the chunk then reports under each reason.
14. **Doors.** The client-side check is a pure function; test it in
    `tests/layers.test.mjs` style with a jsdom render if a render test of
    `BackupScreen` exists, else as a pure helper `fileScope(file)` in
    `src/spaces.tsx` tested directly: a space file is refused by the site
    door and by another space's door, a site file by a space door, and a
    file with no `scope` is a site file.
15. **`PLACED`**: `admin-restore-preview` in `site`; a space admin gets 403
    from it.

Also run the existing restore tests unchanged: flags
(`tests/server.test.mjs` around 2423) and the full-backup test in
`tests/audit-0580.test.mjs`; both delete before restoring, so they pass
under *write when absent*.

## B9. Documentation and release

- `README.md` Spaces section: replace "A space's export and storage (since
  0.546)" with a paragraph on a space's backup and restore, naming
  `scope`, the verdicts and the never-overwrite rule in one line each;
  update "Notes on the data" where it says progress lives only on devices.
- `DECISIONS.md`: "A restore adds and never overwrites" (what it costs:
  no repair in place; the way back is delete then restore); "Deleted on
  purpose means a deletion record exists" (the `gone:` record; a whole
  space's deletion drops them, which is why a deleted space's people come
  back); "Progress is keyed by handle in a backup" (so a new key does not
  strand it).
- `BACKLOG.md`: "Moving a space to another site" — what it needs is a
  handle-collision rule when `created` differs (B4.2) applied to every
  handle, plus a way to pick a new handle for the colliding person and
  rewrite rosters and ownership; declined for now (6a).
- `CHANGELOG.md`: one entry per stage shipped, in A4/A5's words, with "To
  check by hand" from A6.
- `package.json`: bump per stage.
- Then `CLAUDE.md`: `npm run check` green, merge to `beta`, update the open
  pull request.
