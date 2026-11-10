# Audit: is a student's progress ever not saved, or saved wrongly?

**10 November 2026 · release 0.601, commit 62fe111, the tree on `origin/beta`.**
Read-only: nothing in the app was changed by this audit.

> **A second pass was made the same day**, by a separate reading of the
> same paths and by running the built app in a real browser against the
> real server. It confirmed the ordinary path and finding 1 there, and
> added three findings — 23 to 25, under *A second pass* below. Finding 23
> belongs with the high ones: a deck taken off a course and put back
> leaves a student's other device without that deck's cards, and the
> device does not ask for them again.

The question was put as an absolute: at no point, anywhere in the app,
should a student's progress fail to be saved or be saved improperly. So
every path progress travels was read end to end, in four parts — the
practice session (from an answer to the document in memory), the device
(memory to the device's store, several tabs, signing in and out, app
updates), the wire and the server (sync, the stored copy, sign-in keys,
backups), and everywhere progress is *moved* rather than earned (a teacher
changing material, two devices merging, one-time migrations).

A finding marked *reproduced* was run against the real code: the built app
in a scripted browser, the real server on a scratch store, or the real
merge and fold functions. *Read only* was traced through the code and not
run. The three earlier audits of this ground
(`AUDIT-cards-scheduling-progress.md`, `AUDIT-progress-durability.md`,
`AUDIT-stability-0.579.md`) were read first and their fixes checked: all
of them are still in place.

## The short version

**The middle of the road is sound.** An answer that reaches Continue is
filed against the right card, the right form and the right exercise,
exactly once; it is written to the device at once and again on the way
out; it reaches the server; two devices merge without either losing what
both hold; and the server keeps what it is given through crashes, full
disks and simultaneous writes. A simulated 900 questions and 1,100 marks
found none misfiled. Most of what the last three audits found is fixed and
has stayed fixed.

**The edges are not, and there are more of them than "never" allows.**
Twenty-two findings. The ones that touch the most people:

1. **An answer the app has already marked is thrown away unless Continue
   is pressed.** The student answers, sees "Correct!", and then leaves the
   session, or the timer runs out, or the connection changes, or the phone
   is put away. Nothing is recorded — and the Leave dialog says "Answers so
   far are already saved". *Reproduced, three ways.*
2. **A replaced sign-in key leaves the old device saving into a copy
   nobody reads.** The dialog promises the old key "stops working the
   moment you do this, on every device". It does not stop syncing: the
   phone still signed in with it goes on practising, shows a green dot, and
   its work never reaches the person's other devices. *Reproduced.*
3. **Practice on counting, and on the old number cards, was never carried
   over to what replaced them.** Both hand-overs work in their tests and
   have never worked on a real device. Learners who had practised either
   started again from nothing. *Reproduced.* What was earned on counting
   is still recoverable, until about April 2027.
4. **A card withdrawn while a student is practising leaves a blank screen
   with no way out**, and the rest of the session with it. *Reproduced.*
5. **"This was too easy" can say "Moved up a level" having moved nothing,
   and then throws away the right answer it was pressed on.** *Reproduced.*
6. **Being signed out by the server, leaving a space or closing an account
   leaves that person's practice on the device**, and the next person to
   sign in there has it uploaded under their own name. Log out was fixed
   for this in 0.580; these three doors were not. *Reproduced for the
   first; the other two share its code.*

Under those: a device whose store is full fails to save practice before
it fails at anything else; four ways a teacher's ordinary edit, or two
devices meeting at the wrong moment, moves or drops schedules; and a set
of rare server-side weaknesses, none of which loses anything in daily use.

**What they have in common.** Nearly all of them sit at a moment where
something *ends* — a question, a session, a sign-in, a key, a card's place
in a course — and the code for that moment was written for the ordinary
ending only. Continue is the only door that records an answer; Log out is
the only door that sets practice aside; signing in with the new key is the
only thing that rescues a device holding the old one. Each has other doors
beside it that do none of that.

## What is holding up

Read first, so the findings are in proportion. Each of these was checked
by running it.

- **The mark is filed correctly.** 902 simulated questions, 1,107 marks,
  41 matching grids and 50 sentences crediting the words in them: no mark
  on a missing or wrong form, none twice. A schedule never ends up
  answered but "new for ever". The grading builds on the document as it is
  at that instant, never on an older picture of it.
- **The device keeps it.** The write is made at once on the way out
  (closing, backgrounding, a reload for a new build), retried when the
  store refuses, merged with another tab's rather than fought. No update
  reloads the page during a question.
- **The round trip is whole.** Eighteen schedules across a word with two
  spellings, a verb table, a conversation, a text and a sentence survive
  save, load, load again, a merge with themselves and with an older copy in
  either order, and a refresh against the same material. A refresh against
  *edited* material keeps everything when a form is added mid-list, forms
  are reordered, a line is added or moved, a card changes deck or language,
  or a card is withdrawn and comes back.
- **Two devices merge cleanly** when they hold the same material: order
  does not matter, twice is the same as once, nothing either held is
  dropped. Work written by a newer build survives passing through an
  older one.
- **The server keeps what it is given.** Fourteen forced stops during
  three-megabyte writes: the stored document always read back and was
  never older than the last write the server had acknowledged. A full disk
  refuses the write and leaves the stored copy untouched. Twenty
  simultaneous writes: exactly one accepted. A damaged copy is recovered
  from the one behind it and said to be. An empty document is refused.
  The size limits answer by name.
- **Membership changes leave practice alone.** Suspending or removing
  someone does not touch their document. Backups carry practice by person
  and a restore merges it in, never over what is there.

## Findings

Ranked by what a student loses and how ordinary the trigger is.

### High

**1. An answer with its verdict on screen is not recorded unless Continue is pressed.** *Reproduced.*
The mark is written by Continue and by nothing else. Between Check and
Continue the verdict is only a picture on the screen, and four ordinary
things take it away:

- *Leaving the session.* The dialog reads "Answers so far are already
  saved". The one on screen is not. Stopping just after seeing how the
  last one went is the natural moment to stop.
- *A timed session running out.* The app jumps to the summary. With one
  question answered and marked right, the summary read "0 / 0 — Clean run"
  and the day's count had not moved.
- *The connection coming or going, or a recording finishing its
  download.* The queue is re-dealt and the screen is cleared whether or
  not the question on it changed. The verdict vanishes and the same
  question is put again — to a student who has just been shown the answer.
  A half-typed answer goes the same way.
- *The app being closed or put away for good.* Read only; the session
  lives in memory.

An answer typed but not yet checked when the time runs out is discarded
too.
*Fix: one "settle what is on screen" step — the marking half of Continue —
run when a session is left, when the time is up, and when the app is put
away; and the re-deal clears the screen only when the question under it
actually changed. The mark stays on Continue otherwise, which is what
lets "my answer should have been accepted" and "too easy" change it first.
The Leave dialog then tells the truth.*

**2. A replaced sign-in key leaves the old device syncing into a copy nobody reads.** *Reproduced against the real server.*
A practice document is stored under a fingerprint of the sign-in key, and
the sync door checks only that a fingerprint is well formed — never that
it is anybody's current key. When a new key is issued the server moves the
document to the new fingerprint. A device still signed in with the old key
is not signed out (the app deliberately "keeps working locally" when its
key is not recognised); its next sync finds nothing under the old
fingerprint, writes its whole document there as a first write, and is told
it worked. From then on it syncs happily, to itself. In the run: the
laptop on the new key stayed at three repetitions of a card the phone had
taken to nine, and the server held two documents for one person.

The usual reason for a new key is a person who has lost theirs and needs
to sign in somewhere else — which is exactly when the old device is still
in use. Nothing on it says a new key exists; the only sign is an error
where their courses are listed. The work is recovered if that device is
ever signed in with the new key, and lost if it is replaced or reset
first.

`DECISIONS.md`, *Progress follows a reissued key*, records this cost and
says the stray document "is drained into the new one as any older private
key's is". It is not: that list is filled only from a key written inside
a document by a much older build. What rescues the work is the device's
own copy, on the day the person signs in again.

Three rarer faults in the same handover, each *reproduced*:
- The new key is reported as issued even when the document could not be
  moved (a full disk at that moment). The new key then opens an empty
  document, the old one is stranded under a fingerprint the server no
  longer records, and backups stop seeing it.
- A push to the old fingerprint *during* the move is accepted and then
  deleted with the old document.
- If the document was damaged at the time, the good copy behind it is
  thrown away by the move.

*Fix: the server leaves a small marker under the old fingerprint so that
a sync there is refused by name ("this key was replaced"), which keeps the
sync door ignorant of who anybody is; the device, told that, keeps its
practice, stops syncing, and asks for the new key with a standing message;
signing in merges what it held. On the server, copy first and switch the
key only once the copy has landed, and carry the copy behind the document
too.*

**3. Practice on counting, and on the old number cards, was never handed to what replaced them.** *Reproduced.*
Two one-time hand-overs, both passing their tests and neither working on a
device:

- *Counting things* moved from parts of its own into the stretches of
  numbers (4 October). The hand-over gives a stretch only the exercises
  it "has nothing on" — but a document in memory carries a blank schedule
  for every exercise, so the stretch always has something, and nothing is
  ever handed. The tests build their cards without the blanks.
- *A teacher's old number cards* were replaced by cards made from the
  number system, and the system records which old card each came from —
  by the card's name on the server. A device knows the same card by a
  different name, so the lookup finds nothing. The tests hold the old card
  under the server's name, which no device does.

Either way the new card or stretch started as new for a learner who knew
the old one. The old counting parts' progress is still set aside on each
device and can be handed on properly until it ages out, about 180 days
after the change. For the number cards, the old cards were left on
devices on purpose, so their schedules can still be read where they have
not since been withdrawn.
*Fix: treat a never-answered schedule as absent in the hand-over and in
the fold that applies it; look the old card up by the device's name for
it; and, once, hand on to a stretch or card that is still unanswered on
the exercise in question, so the devices that missed it are put right.*

### Medium

**4. A card withdrawn mid-session leaves a blank screen with no way out.** *Reproduced.*
When the question on screen, or the next one in the queue, names a card or
form the device no longer holds, nothing is drawn: no question, no
summary, no buttons, and the bar at the foot is hidden because the app
still believes a question is up. Only a reload escapes, and the rest of
the session — and any verdict that was showing — goes with it. The
trigger is a teacher removing a card, a form, a turn of a conversation or
a verb's tense while a student practises (material is re-checked every 45
seconds), or a deletion arriving from the student's other device.
*Fix: a question that no longer resolves is skipped the way an unaskable
one already is, and the way out of a session is always drawn.*

**5. "This was too easy" can do nothing, say it worked, and discard the answer.** *Reproduced.*
Pressed on a review from a level *below* the one the card is working on —
the ordinary state of any card partway up — there is nothing to lift,
because that level is already solid. The message still says "Moved up a
level. It comes back at the next one", and Continue then skips marking the
question, as it does after a real lift. So the right answer is not
counted, the review stays due, and the same question is back next session.
*Fix: lift the level the card is actually on, which is what the release
note says it does; and where nothing was lifted, mark the answer normally
and do not claim otherwise.*

**6. "My answer should have been accepted" on a matching grid still files the misses.** *Reproduced.*
The screen turns to "Correct!", the count moves on, and the two words
that were mismatched are marked wrong underneath — and, because the
session now believes the answer was right, are not asked again. A verb
table honours the same button; the grid does not.
*Fix: an overridden grid marks every pair right.*

**7. Three ways of being signed out leave one person's practice for the next.** *Reproduced for the first.*
Log out sets the practice aside under the person's name and empties the
device (0.580). Being signed out by the server (a closed space, a
suspension), leaving a space and closing an account do neither: the
document stays where it is. The next person to sign in on that device
sees it, and their first sync uploads it under their own key — the
earlier person's cards, and the earlier person's progress on any course
card the two share, over their own where it is newer. In the run, two of
the first person's cards went up under the second's key with thirty
repetitions on each. A shared tablet in a classroom is where this
happens.
*Fix: every door out goes through the one Log out uses. Closing an
account empties the device instead of setting aside, since the practice
is being deleted on purpose.*

**8. When the device's store is full, practice is what fails to save.** *Reproduced.*
The practice document shares one small store — about five megabytes —
with things that are only kept for convenience and could be fetched
again: a teacher's Teaching and Admin lists, the course list, recordings
on a device without the larger store, and a set-aside copy of the whole
document for every person who has logged out there. Whichever arrives
first keeps its place. In the run, with the store filled by a cached
Teaching list, a document at well under one per cent of its own limit
could not be saved; the warning came up and the cache went on holding the
space. The early warning that exists measures the document alone, so it
says nothing until long after this point. A signed-in learner's answers
still reach the server; one whose sync is also failing loses them at the
next reload.
*Fix: when the document will not save, drop what can be fetched again and
try once more before warning; count everything in the store, not the
document alone, when deciding to warn; and keep set-aside copies only
until they are known to be on the server.*

**9. A device with out-of-date material can delete another device's progress on new forms.** *Reproduced.*
When two devices merge a course card, the list of forms and of turns is
taken from whichever touched the card last, and anything only the other
holds is dropped. Every answer counts as a touch. So a device that has
been offline since before the teacher added a plural, and answers the
card, is "last" — and its first sync, if it lands before its own refresh,
removes the plural and whatever the other device had earned on it. It is
narrow: both start together at launch, and the other device has to sync
inside the gap. When it lands it is permanent.
*Fix: keep, from the other side, any form or turn that carries real
progress — the rule already made for a verb's tenses. If the teacher did
remove it, the next refresh drops it.*

**10. A card withdrawn while a second device is offline loses work on it.** *Reproduced.*
Withdrawn progress is set aside in case the card comes back, but only by
the device that sees the withdrawal. The other device's unsynced answers
on that card are deleted by the merge without being set aside; or, if it
answered after the withdrawal, its poorer record replaces the first
device's richer one whole. Withdrawals are ordinary and often accidental —
a deck detached and put back, a student removed and re-added, one number
word left blank, which withdraws every number card of that system. After
the card returns, both devices are short of what one of them had earned.
*Fix: set aside what a merge is about to delete, and combine two
set-aside records answer by answer rather than taking the later one
whole.*

**11. Three ordinary edits by a teacher move or drop schedules.** *Reproduced.*
- *A new form inherits a removed form's progress* when it lands in the
  same place in the list — deleting the last form and adding another is
  enough. The place-by-place matching exists for forms written before
  forms had names, and is applied to named ones too.
- *A card with several accepted answers keeps a schedule per answer by
  its place in the list.* Reordering them, or removing one, hands each
  schedule to a different spelling.
- *A form removed and put back under the same name starts again.* Most
  real for number words, whose names are fixed: blank one and retype it.
*Fix: match by place only where the held form has no name; follow an
accepted answer by its text; set a removed form's progress aside under
its card, as a whole card's already is.*

**12. A preference changed on one device can discard a saved session or a prep made on another.** *Reproduced.*
Not practice, but the learner's own setup, which rides in the settings —
and settings travel whole, last change wins. Add a saved session on the
phone, change the keyboard on a laptop that has not synced since, and the
session is gone from both. The app does this by itself too: a new
device's first refresh sets the language and stamps the settings as
changed, which can beat the older device's.
*Fix: merge saved sessions one by one and the prep by its own date; do
not count the automatic language switch as a change.*

### Low

**13. An empty file on the server reads as "never written".** *Reproduced.*
The 0.148 fix makes an unreadable record fail the request. A zero-length
one still reads as absent, so a student's material is answered as
complete with a card, a deck or a course missing — which a device takes as
withdrawn — and an empty list of courses is then written over for good by
the next course made. It needs disk damage rather than a crash, and
withdrawn progress is set aside now, which softens it.
*Fix: only "not there" means absent.*

**14. One malformed card stops every device, and a document that will not load is replaced by an empty one.** *The failures reproduced; the overwrite read only.*
The server accepts any object as a practice document, and the merge on
every device throws on a card that is not a card — so one bad entry
stored once is "Sync failed" on all of them, for good. On a device, a
stored document that fails to load is treated as no document at all, the
app opens empty, and the next save writes over it with no copy kept.
Nothing in the app writes such a document today; this is about the next
bug rather than a present one.
*Fix: the server refuses a document whose cards are not cards; the merge
steps over what it cannot read; a document that will not load is kept
under another name before anything is saved.*

**15. A backup leaves out practice it could not read, without saying.** *Reproduced.*
One person's document failing to read during a backup is skipped; the
file is reported complete.
*Fix: name whoever was left out.*

**16. Two deletes on the server take no care.** *Reproduced; second read only.*
Deleting a practice document asks no questions, so a write landing just
before it is gone. And the app's own clean-up of a document under an old
private key deletes it even when the read before it failed. Both concern
only documents left by much older builds.
*Fix: delete only the version that was read.*

**17. "Reset scheduling" leaves three things behind.** *Reproduced.*
The daily counts it empties come back at the next sync; "moved up" and
"cleared" tallies are never emptied; and progress set aside for a card
that was away during the reset returns with the card. Separately, once a
card has ever been reset, which words its blanks have been filled with
stops merging between devices for good.
*Fix: a reset recorded on the document as it is on the card, read by the
merge and by the drawer.*

**18. Continue has no guard of its own.** *Reproduced only artificially.*
Two presses with no redraw between them mark the answer twice — which
reads as "missed twice" and shuts a level — and skip the next question.
Two real taps are safe; no real route to it was found.
*Fix: Continue does nothing without a verdict, once per question.*

**19. Practice set aside at log out is taken back only at the moment of signing in.** *Read only.*
If the page reloads between the sign-in and the taking back, the app
opens signed in and the set-aside copy is never looked at again — and is
overwritten at the next log out. And a second tab left open through a
log out still holds the document and writes it back.
*Fix: look for a set-aside copy at every launch; a tab that sees the
account change stops writing.*

**20. Four writes build on the screen's picture of the document rather than the document.** *Read only.*
Reset, the high-priority mark, undo delete and every settings change. All
run straight from a tap, so the gap is a sync landing in the instant
before the screen has redrawn. Very unlikely; the grading path does not
have it.
*Fix: the same form of write the grading path uses.*

**21. Known and deliberate, for completeness.** A device whose clock is
behind loses its later answers to the other's earlier ones (recorded as
inherent in the 0.147 audit; *reproduced* again, including answers given
minutes after a reset made on a device running fast). Daily counts take
the larger of two devices' rather than the sum, so two devices used on
the same day before syncing under-count (recorded as deliberate).
Progress set aside is destroyed after 180 days.

**22. Whether production keeps its data cannot be told from the repository.**
The deploy file holds only the start command. With no volume attached the
server runs and logs a warning; with the data folder pointed somewhere
that does not persist, it counts as durable. To check by hand: the
start-up log should say the data folder came from the volume.

## A second pass

Made after the list above was written, and independently of it: the same
paths were read again from the code before this document was opened, and
then the built app was driven in a real browser (Chromium) against the
real server on a scratch store — the first pass used a scripted browser,
which cannot show what a real one does with storage, the network and a
page being closed.

**What it confirms.** In the real browser, one student practising on a
phone: forty answers given, forty recorded, the same forty after closing
and reopening, the same forty on the server a few seconds later, and the
same forty on a second device at its first launch. Twelve more given on
the second device were on the first at its next launch. Nothing misfiled,
nothing dropped. Finding 1 was reproduced there too: one answer recorded,
a second marked "Correct!" on screen, the app put away and reopened — one
answer recorded. The separate reading arrived at findings 1, 7, 9, 10, 12
and 20 on its own, which is some evidence they are what the code does and
not one reader's slip.

**What it adds.** Three findings, one of them high.

**23. A deck taken off a course and put back leaves the student's other device without its cards — and that device never asks for them again.** *Reproduced in the real browser. High.*
A student with a phone and a laptop, two decks in one course, six cards
in each, practised on both. The laptop is closed. The teacher takes the
second deck off the course by mistake; the phone, which is open, removes
its six cards, sets their progress aside and syncs — all as designed. The
phone is put away. The teacher puts the deck back a minute later. The
student opens the laptop:

- its sync brings the phone's deletions, and the six cards go;
- its check for new material is answered "nothing has changed", because
  as far as the server can tell nothing has: a deck taken off and put
  back leaves the material's fingerprint exactly as it was;
- so the home screen reads "0 of 6 cards learnt" — six cards, for a
  student who has twelve — and goes on reading that at every launch. In the run it was opened three
  times. The server, asked directly, listed both decks with six cards
  each.

It stays that way until the phone is next opened (which notices, fetches
the deck, restores the progress and syncs it across) or until a teacher
changes anything at all in the student's material. If the phone is never
opened again — it was the old phone — only the teacher's next edit ends
it. The progress itself is not destroyed: it is in the drawer, and came
back whole in the run (21 repetitions before, 21 after). What a student
sees in between is half their course and all their progress on it gone
from the device they are holding, with nothing to say why and nothing
they can press. Anything answered on that device and not yet synced is
lost for good, which is finding 10.

The same happens wherever the material comes back *exactly* as it was: a
student taken off a course and added again, a student suspended in a
space and reinstated, a deck's number parts switched off and on.

The cause is one assumption: the device tells the server which version
of the material it last received, and takes "unchanged" to mean "what
you hold is right". That is true only while a refresh is the one thing
that removes course cards. A merge removes them too.
*Fix: when a merge — a sync, or another tab — removes a course card this
device was holding, forget the version last received and ask for the
material in full, there and then. With finding 10's fix beside it (set
aside what the merge is about to delete) the cards and every answer are
back before the student has seen them go. Moving the fingerprint on the
server whenever a deck is attached would cover the deck and not the
student who was removed, so it is the weaker of the two.*

**24. On a shared device, the next person to sign in can be told there is nothing for them.** *The server's half reproduced; the app's half read only. Low.*
The same assumption at another door. The version last received is kept
for as long as the page is open, and logging out does not clear it. A
classmate signing in on the same tablet without the page being reloaded
asks with the previous person's version — and two students in the same
courses have the same version, so the server answers "unchanged" (it did,
in the run) and the app shows them no courses and no cards. Nothing is
lost, and reopening the app puts it right; but it is a student who cannot
practise, on exactly the classroom tablet finding 7 is about.
*Fix: forget the version whenever the person signed in changes.*

**25. A problem a learner has marked on a card is wiped by the next change to the material.** *Reproduced. Low.*
Not practice, but the learner's own note on their own card — the mark
that makes a reported card findable on the device afterwards. A refresh
takes the card from the teacher's copy and keeps the schedules, the
high-priority mark and the reset stamp; the report marks are not on that
list, so the next refresh that finds anything changed clears them. The
report sent to the teacher is unaffected.
*Fix: keep them through the fold, as the high-priority mark is kept.*

**And one more for finding 21's list of the known and deliberate.** *Read
only.* A device that has been away answers from the picture it had. Two
devices merge each question by whichever answered it last, whole — so an
answer given on a tablet that has not synced for a month, to a card the
phone has since taken to Learnt, replaces the phone's month with the
tablet's one answer. Online this needs the answer to land in the second
or two before the launch sync does; offline it needs only the tablet. It
is the same rule that makes two devices safe in ordinary use, and is
inherent in it.

## What to do, in order

1. **Every door records** (findings 1, 4, 5, 6, 18): settle the question
   on screen when a session ends by any route; skip a question that no
   longer resolves; make "too easy" and the grid's override do what they
   say. This is the one a student meets most.
2. **A replaced key is refused and asked for** (finding 2), with the
   server's handover made safe.
3. **Every door out sets practice aside** (findings 7 and 19).
4. **The hand-overs that never worked** (finding 3), with the one-time
   repair while the counting progress can still be recovered.
5. **Merges and folds that keep what they are about to drop** (findings
   9, 10, 11, 12, 17, 25) — and, with finding 10, **a device that has
   lost cards to a merge asks for its material again** (finding 23, and
   24 by the same change). Finding 23 is worth doing early: it is small,
   and it is the one a student with two devices will meet as "my progress
   has gone".
6. **Room on the device** (finding 8).
7. **The server's rare ones** (findings 13 to 16) and the small device
   ones (20).
8. Each with the test this audit found missing — see the appendix. The
   pattern behind findings 3 is worth a rule of its own: a fixture must
   be a document as a device really holds it (saved, then loaded), not as
   it is convenient to write.

---

## Technical appendix

Lines are as of commit 62fe111. `AT` is `src/ArabicTrainer.tsx`.
Reproductions were scratch scripts and are not in the repository; each is
described closely enough here to be written again as the test its fix
should arrive with.

**1.** The verdict is React state (`checked`, set in `check`, `AT:12772`);
the only write is `applyGrade` (`AT:13122`). Leave: `ConfirmModal` at
`AT:15230-15241` calls `setSession(null)`. Time out: effect at
`AT:13367-13371` sets `qi` to the queue's length. Re-deal: effect at
`AT:12795-12816` calls `resetExercise()` (`AT:12812`) whenever
`requeueUnaskable` returns a different array, without comparing
`next[qi]` to `session.exercises[qi]`. Reproduced in jsdom on the built
app: answer, verdict up, then (a) X → Leave: form state and `log`
unchanged; (b) five-second timed session, verdict "Correct!" up at 0:04,
after expiry `states: []`, `log: {}`, summary "0 / 0"; (c) `offline`
event with a typed-answer verdict up: verdict gone, Check back, same
card, nothing recorded.

**2.** `server/api/sync.js:277-280` tests the token's shape only.
`admin-reissue-key` (`server/api/courses.js:6734-6756`): deletes the old
key map, writes the user with the new `keyHash`, then
`moveSyncDoc(...).catch(() => {})`, then `ok: true`. `moveSyncDoc`
(`sync.js:237-274`): read old, write new `onlyIfNew`, copy clips, delete
old; no lock across it; `store.delete` removes `.prev` too. Client:
`whoAmI` catch (`AT:10088-10095`) signs out only on `space-closed` /
`suspended` / `suspended-app`; `LEGACY_SYNC_KEYS` is filled only in
`loadData` from `parsed.account.key` (`AT:7161`). Reproduced with the
real server and the real `syncOnce`: sync under old key; re-issue;
`whoami` with old key → 401 `bad-key`; new key sees reps 3; old key
`syncOnce` with reps 9 → accepted; new key still 3; GET under old token →
a document with reps 9. Server-only parts: re-issue on a 600 KB tmpfs →
200 `ok`, new key `{etag:null,data:null}`, old token still 100 items,
backup manifest `progress: 0`; pushes to the old token during a move with
twelve 600 KB clips each answered 200 and gone afterwards; damaged main
plus good `.prev`, then re-issue → new key `lost: "unreadable"`.

**3.** `handOnCounting` (`src/numbers/generate.ts:785-815`) filters
`!(type in mine)`; `liftStates` (`AT:~6902`) puts a state under every
type on load, so `mine` has every key. `foldForms`
(`src/shared.tsx:5603`) lays `{ ...carried, ...s }`, so a fresh state in
`s` would win even if something were handed. `handOn`
(`generate.ts:698-722`) looks up `sys.migratedFrom[slot]`, written as the
server's `card.id` (`src/numbers/migrate.ts:139,151`), among device items
named `srv<cardId>` (`localIdFor`, `shared.tsx:5026`). Reproduced: sparse
fixture → `carried = ["count2phrase"]`, reps 6 after the fold; the same
items through save and load → nothing carried, reps 0, and nothing from
the drawer on the next refresh. Old card held as `srvk40` → nothing
carried; with `migratedFrom` rewritten to `srvk40` → carried.

**4.** The question draws only if `session && exercise && item && spec`
(`AT:13921`); `item` is null when `resolveUnit` (`AT:6631`) misses;
`inExercise` stays true (`AT:13462`, `15378`) so the dock is off.
`requeueUnaskable` handles a gone card (`AT:3966-3972`) but runs only on
`[offline, audible, visible]`. Reproduced by a `storage` event carrying
the deletion: no buttons on the page, root class `in-exercise`.

**5.** `liftCurrent` (`AT:13056-13120`) sets `easedFor` (`AT:13082`)
before the write; `liftLevel` skips solid keys (`src/scheduler.ts:~564`)
so the write returns `cur` (`AT:13100`); the flash at `AT:13112` is
unconditional; `applyGrade` spares the question (`AT:13165`, `13200`;
`src/grade.ts:439`). Reproduced: `ar2pick` review due, `match` open
above; after "too easy" + Continue the state is unchanged and still due.

**6.** `gridMarks` (`AT:~12635`) ignores `overridden`; `verbMarks`
(`AT:~12604`) honours it; `marksForAnswer` (`AT:6148-6157`) uses each
pair's own `right`; requeue is on `!correct` (`AT:13243`). Reproduced:
two swapped words end `wrong=1 hist=[0]`, count 2/20.

**7.** `parkForLogOut` is called only from `onLogOut` (`AT:15272`).
`AT:10090-10094` (forced), `LeaveSpace` (`AT:18347-18353`) and
`CloseAccount` (`AT:18409-18411`) call `API.clearAccount()` and
`setAccount(null)`. Reproduced in jsdom: `whoami` answered 403
`suspended`; sign-in screen up; the main document still holds the first
person's cards; nothing under `:parked:`; second person signs in; their
token's document on the stub server holds the first person's two cards.

**8.** `saveData` → `storage.set` → `localStorage.setItem`
(`src/storage.ts:23-32`). Same store: `SPACE_KEY`
(`shared.tsx:4703-4725`), `MATERIAL_KEY` (`AT:9616`), `PARKED_KEY`
(`AT:880`, written whole at `AT:10770`), `AUDIO_KEY` fallback
(`AT:7547`), outboxes, sync config. `docSize` (`src/sync.ts:471-493`)
measures the document only. Reproduced in jsdom (quota 5,000,000 units):
store filled to 4,999,839 by `arabic-trainer:space:teach`; a card
arriving by sync is in memory and on the server, not in the stored
document; the warning is up; the cache still holds 4,980,025 units.

**9.** `mergeItem` (`src/sync.ts:98-170`): `base` by later `updated`;
`forms` from `formsOf(base)` plus only `isTenseForm` forms of `other`
(`:138`); `lines` from `base`. `withMark` stamps `item.updated`
(`src/grade.ts:410`). Reproduced: A holds and has answered `fdual` and
line `lb`; B, on the old card, answers later and syncs before
refreshing; A syncs in the gap and ends without the three schedules,
still without them once everything has settled. B refreshing first: none
lost.

**10.** `mergeData` (`sync.ts:231-233`) filters tombstoned items without
parking; `parked` merges by later `at` whole (`:244-248`); `foldCourses`
assigns `nextParked[it.id] = saved` (`shared.tsx:5824`). Reproduced both
orders; after the card's return both devices lack what one had earned,
and the drawer entry and headstone are still in the document.

**11.** `foldForms` (`shared.tsx:5587`): `matched[i] || (taken.has(i) ?
null : had[i])` with no test that `had[i]` is positionally named.
`keyFor` / `answerOf` (`src/languages.ts:1297-1305`) key by index.
`foldCourses` keeps only the fresh card's forms (`shared.tsx:5779-5780`).
Reproduced each.

**12.** `mergeData` (`sync.ts:282-296`) takes `settings` whole by
`settingsUpdated`; `refreshCourses` stamps it for the automatic language
switch (`AT:11555-11566`). Reproduced: list on both, phone adds one,
laptop changes the keyboard → phone ends with the old list.

**13.** `readJson` (`courses.js:599-600`): `if (!raw) return null`;
`updateJson` (`:~652`): `if (held && held.data)`. Reproduced: a card file
at zero length → 200 `ok`, two cards of three, same version (so
`unchanged` to a device holding it); deck, course and `index:courses` at
zero length → none; `create-course` then rewrote the index to the new
course alone.

**14.** `sync.js:368` accepts any object; the would-empty guard
(`:395-408`) fires on zero items only. `merge` (`AT:7114`) throws on a
null in `items` or `forms`, `s: null`, `lines` not a list; `mergeData`
on a remote null item, `forms: [null]`, `parked: { x: null }`. `loadData`
(`AT:7154-7170`) catches and returns `EMPTY`.

**15.** `courses.js:5800`: `readSyncDoc(u.keyHash).catch(() => null)`
then `continue`.

**16.** `sync.js:425-428`; `drainRemote` (`src/sync.ts:694-704`) calls
`forgetRemote` after a pull that threw for any reason.

**17.** `resetScheduling` (`AT:11833-11854`) writes `log: {}`,
`prepLog: {}`; `mergeData` takes the larger per day (`sync.ts:253-262`);
`moves` and `parked` are not touched; `withProgress` restores onto a card
with no `reset`. `metOf` returns nothing once `reset` is set
(`sync.ts:190`), and the stamp never leaves the card.

**18.** `applyGrade` (`AT:13123`) tests `item`, `parentItem`, `exercise`,
not `checked`.

**19.** `adoptParked` is called only from `Onboarding`'s `onDone`
(`AT:13433`), which on one branch reloads first (`AT:13427-13430`) and in
`signIn` (`src/spaces.tsx:262-270`) is reached after `saveAccount` and,
for an account whose key is not yet saved, after another screen. The
`storage` listener (`AT:10881-10897`) ignores an emptied document.

**20.** `AT:11851`, `13272`, `13315`, `13329` pass `{ ...data, … }` to
`persist`.

**23.** `refreshCourses` sends `materialVersion.current` (`AT:11506-11511`),
set from each answer (`AT:11515`) and seeded at launch whenever the
document holds *any* course card (`AT:11630-11634`). The sync's adoption
(`AT:10331-10339`) and the `storage` listener (`AT:10890-10896`) commit a
merged document without touching it; `mergeData` drops tombstoned items
(`src/sync.ts:231-233`). On the server `materialVersion`
(`server/api/courses.js:980-998`) reads each course's count of decks and
each deck's `version`, title, card count and parts; `attach-deck` /
`detach-deck` (`courses.js:4594-4630`) change the course's list and the
deck's links and neither the deck's `version` nor, once reattached, the
count; the roster (`:4676-4700`) is not in the fingerprint at all, only
in which courses are read. Reproduced with Playwright's Chromium, the
built `dist/` and `server/index.js` on a scratch `DATA_DIR`: two decks of
six, both devices at 45 repetitions; laptop page closed; `detach-deck`;
phone reloaded → 0 cards of the deck, 6 tombstones, 5 drawer entries, the
same on the server; phone closed; `attach-deck`; laptop opened → 6 items
in all, none of the deck's, the same after two more launches, while
`my-material` for the student lists both decks at six; phone opened → 6
cards back, 21 repetitions on them as before; laptop's next launch → the
same.

**24.** `materialVersion` is a ref assigned only at the three places above;
`onLogOut` (`AT:15269-15283`) clears the courses and decks on screen and
not it, and `materialSeeded` is already true. Reproduced at the server: a
second student of the same course asking `my-material` with the first
student's version is answered `{ unchanged: true }`.

**25.** `cardToItem` writes `flags: []` (`src/shared.tsx:5295`);
`foldCourses` lays `priority`, `priorityAt`, `reset`, `forms` and `lines`
over the fresh card (`shared.tsx:5762-5781`) and nothing else. Reproduced:
one flag before the fold, none after.

**Tests that do not exist and would have caught these:** a session left,
timed out and re-dealt with a verdict up; a question whose card has gone;
"too easy" below the working level; a grid overridden; a sync under a
replaced key, and a re-issue whose move fails; a sign-out by each door
followed by another person's sign-in; both number hand-overs on a
document that has been saved and loaded, with the old card under its
device name; a merge where the later side lacks a form the other has
answered; a merge that deletes a card the device has answered; a fold
that replaces the last form; accepted answers reordered; settings changed
on two devices; a zero-length record; a document with a null in its
cards, stored and pushed; a save into a full store. And from the second
pass: a merge that removes course cards followed by a refresh the server
answers "unchanged"; a second person signing in on the same page; a flag
through a fold.
