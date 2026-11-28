# Backlog

Work that is wanted and not started, each with why it waits. One entry per
item, newest last. An entry leaves when it ships, or when a decision says
it never will.

What is *not* here: anything already being worked on, and anything nobody
has actually asked for. A wish is not a backlog item until somebody can
say what it would change for the people using the app.

These lived in a proposal's *open questions*, an audit's *what to do next*
or a *revisit if* line in `DECISIONS.md` before this file existed. Those
are still where a reason belongs; this is where the item goes so it can be
found without reading the reason first.

---

## A speaker to read the Hebrew clock

`tests/golden/he-IL.times.json` says in its own note, and in a test, that
nobody who speaks the language has read it. Every row in it is what the
composer says given the words in the fixture, and the dozen rows where two
answers are both plausible carry a line saying what the other one would be.
The Arabic table is in the same position and says so too.

The words are the claim; the rows are arithmetic over them. So a speaker
correcting the words fixes their own screen and nothing here has to change,
which is the point of the lexicon being data — but the table should stop
being a set of hypotheses at some point, and `reviewedBy` is where it stops.

## Telling the time in Vietnamese

Numbers, yes; a clock, not yet. Nobody has written down how the language
does it, and the composer registry answers `null` for it, which the app
already handles everywhere: the Time tab says the language has no clock.
Waits on somebody who teaches it.

## Text-to-speech for a number nobody recorded

A rendered number with no recording could be spoken by the device. Waits on
two answers nobody has: which voice per dialect, and whether a synthetic
voice is a thing this app wants a learner to imitate. The audio policy
stays *components only* until then — one clip per word, and a time may play
its two pieces one after the other.

## Deleting the old number cards

The migration marks them `derived` and deletes nothing: a card carries
recordings and somebody's progress, and clearing a box was never a way of
asking for either to be thrown away. A learner's schedule on one has
already been handed to the card that replaces it. One release from now they
can go, with their recordings kept as clips the system points at.

## A transliteration a number can be built out of

A word in a system may carry a transliteration per face. Since 0.354 the
answer screen shows a whole number's, read along the words it was built
from (`sayAlong`), but nothing marks against it — so a range has no
*transliteration → script* question, which is the level-3 exercise every
ordinary card gets. A counted noun has no box for one either, so a counting
question shows none.

## A preview each language chooses

The list of numbers under *What a student will be asked* is one list for
all three languages, chosen by eye to cover the shapes any of them can get
wrong. It is Arabic-shaped, and it shows: the unit that changes after two
tens is a Vietnamese rule, and it is in there because somebody remembered, not
because Vietnamese asked for it. A composer already declares which boxes it needs
and which ranges it can build; which numbers are worth showing is the same
kind of answer and belongs beside them.

## One system per course

A teacher of two courses in one language who wants different words in each.
No known ask; the per-teacher rule stands until there is one.

## Ordinals, fractions, dates, currency

Out of scope by decision for the first version of the number system. Each
is a composer of its own over the same lexicon, which is the shape that
makes them cheap later and was worth designing for now.

## Stitching audio inside a number

Playing *forty* and then *seven* as one clip. Declined for the first
version: the joins are where a dialect's sandhi lives, and a stitched clip
teaches a sound nobody makes. A time is the one exception and plays two
recorded pieces, which are two words and not two halves of one.

## `Doc.version` is written and never read

The lifts key on the shape of what they find, which is what makes them safe
to run twice. The version field is written on every save and read by
nothing. Either give it a meaning or drop it.

## The endings on a noun, as a skill

*My book*, *your book*, *his book* are a table on every noun, and each
cell is still learnt on its own, the way a verb's persons were until 0.457.
The owner chose to see how tenses as skills go before doing the same here.

## Moving a space to another site

A space's backup restores into the same site only
(`docs/PLAN-space-backup.md`, 6a). Putting it into another server would need
the rule that tells two people with one handle apart (`created` differs)
applied to every handle, a way to choose a new handle for the person who
collides, and rewriting every roster, owner and list that names the old
one. Declined for now: nobody has asked to move a space between servers.

## A class view of who is on which unit

Wanted later (the owner's 2b, 12 November 2026). A teacher sees a
course's path and each unit's checklist, but not where the class is on
it: how many students are on each unit, and who marked one as cleared.
Left out of the first version of units (0.613–0.619); see DECISIONS.md,
"Units: a course's path". Waits on the server knowing a learner's path,
which today lives only in their synced settings.

## Turning an existing deck into a unit

Wanted later (2b, 12 November 2026). A unit is a deck with `unit: true`,
so a teacher with a deck already written could make it a step of a path
instead of copying its cards into a new unit. Left out of the first
version; waits on deciding what happens to the courses that already hold
the deck as an ordinary one, since a unit is on the path of every course
it is in (A1).

## Sentences that use each student's word in a personal set

Left out of personal sets (0.629–0.632). Sentences with the right *I* and *you* for each student's answer, so a set's words are practised in use. The owner chose pictures and words first (15 November 2026); waits on deciding how a sentence names a picture's person.

## Typed answers, or more than one answer per picture, in a personal set

Left out of personal sets (0.629–0.632). Every answer is chosen from a list today, so it can be marked. A typed answer, or two words for one person, waits on a way to mark what nobody listed.

## Copying a word list

Left out of personal sets (0.629–0.632). A list is an ordinary deck; a second list is a new deck, and its words can be pasted or imported into it. A Copy button waits on someone asking for one.

## Joining a word and a name where the language changes them

Left out of personal sets (0.629–0.632). "Both together" puts the two side by side with one space. Languages that join or change them wait on a rule per language.

## Progress kept separately for name, word and both

Left out of personal sets (0.629–0.632). One picture takes turns between the three, and changing an answer starts it again. Separate progress per kind waits on a reason the turns are not enough.

## A teacher seeing or correcting students' answers in a personal set

Left out of personal sets (0.629–0.632). The owner chose that teachers do not see them (15 November 2026). An answer reaches a teacher only in a problem report a student sends.

## A count of recordings per voice

Left out of personal sets (0.629–0.632). The deck check lists what is missing a recording; nothing more was needed for personal sets.

## Personal sets in someone's own space

Left out of personal sets (0.629–0.632). Only courses a teacher runs; a deck in My space is refused. Waits on someone asking for a set of their own.

## Slim text tabs, everywhere there are tabs

Chosen by the owner on 28 November 2026 (the "Calmer Cards screen"
proposal, question 4, option a) and held back on purpose. The tab row —
Modules / Cards / Word sets in Material, and every other row drawn by the
same component — becomes the words on one line with the chosen one dark
and underlined, in place of the grey tray with an icon over each word.
About half the height, and the icons go.

It waits because the tab row is one component used across the whole app:
it is a change of its own, to be tried on every screen that has tabs, and
not a rider on the Cards-screen work it was proposed with.

**Remind the owner of this whenever the Cards screen or the tabs are
worked on, and at the end of that work,** until it is built or a decision
says it never will be. The owner asked to be reminded.
