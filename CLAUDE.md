# Working on this repository

Notes for Claude Code, and for anyone driving it. Conventions for the code
itself are in `README.md`; what is here is how work gets delivered.

## Finish on beta, without being asked

**`beta` is the branch that deploys.** Work that only reaches a feature
branch has not been delivered — it is sitting where nobody can see it.

So: develop on whatever branch the task names, and when the work is done and
checked, **merge it to `beta` and push, every time, without asking.** This is
a standing instruction from the repository's owner. Do not stop to ask
whether to merge, and do not report a change as delivered until `origin/beta`
carries it.

Before the push to `beta`:

- `npm run check` is green on the exact tree being pushed — lint, types, unit
  tests, the smoke harness, and the build, which is what CI runs too.
- The release in `package.json` is bumped and `CHANGELOG.md` says what
  changed, in the terms `README.md` describes.

How to push it:

```bash
git fetch origin beta
git push origin <your-branch>:beta      # a fast-forward, the usual case
```

A checkout may hold a **local `beta` that is unrelated to `origin/beta`** —
one that shares no history with it and deploys nothing. Do not merge into
that branch by habit; confirm what you are about to push with
`git rev-list --left-right --count origin/beta...HEAD` and push the branch to
the remote ref, as above. If the push is not a fast-forward, merge
`origin/beta` into the work first and resolve it there — never force-push
`beta`.

Opening a pull request is still something to be asked for. Merging to `beta`
is not.

## Keep the open pull request's title and description current

An open pull request follows its branch, so every push to `beta` adds to the
pull request merging `beta` into `main`, if one is open. **After every push
to a branch that has an open pull request, update that pull request's title
and description, every time, without asking**, so they describe everything
it now carries, not only what it was opened with:

- The title names every release the pull request spans (for example
  "0.364–0.365: …") and what each is about.
- The description has a section per release, newest first, in the plain
  terms of the changelog: what changes for the people using the app, any
  trade-off, and anything still to be checked by hand. Then whatever else
  rode along, and what was checked (`npm run check` on the pushed tree).
- Check for an open pull request after pushing; do not assume there is
  none. A change that is not a release (a test, a note like this one) goes
  under "Also included".

Do not report the work as delivered until the pull request says what it
carries.

## How to talk about the work

**Plans, proposals and summaries of what was done are written for the
owner, not for the code.** Plain language, and short: what is wrong or
wanted, what will change for the people using the app, what it costs, and
how it will be checked. No file paths, function names, line numbers or
mechanism unless the owner asks — those belong in commit messages,
`DECISIONS.md` and comments, where a reader wants them. If a technical
detail must be kept in a plan for the build's sake, put it in one short
section at the end, clearly marked as such.

This applies to every plan presented for approval, every proposal offered
in conversation, and every summary of actions taken at the end of a piece
of work.

## How to ask clarifying questions

Asking is part of every piece of work, without waiting to be told to. When
anything in a request is unclear or could be read more than one way, ask
before building on a guess. When everything is clear, do not invent
questions for the sake of asking; get on with it.

Whenever there are questions for the owner, while brainstorming, before
building or at any other point, ask them this way, every time (and in an
artifact page rather than the chat, as the next section says):

- Questions are numbered 1, 2, 3, and so on. Numbers are for questions only,
  never 1a or 1.1 for a question.
- Questions may be grouped under headings by topic, but the numbering runs
  on across headings: if the first heading holds 1 and 2, the next starts
  at 3.
- One question per number, never two in the same item.
- Every question offers options, lettered a, b, c under it, so the owner
  can answer the whole set in a line ("1a, 2b, 3a"). This holds even for an
  open question: suggest likely answers as options; the owner can still
  write their own.
- The recommendation is part of the recommended option itself, never a
  separate line or item after the options: that option is labelled
  "Recommended" and carries the very short reason why, a sentence at most.
- Concise and non-technical, in the same plain terms as above.

## Questions and proposals go in an artifact, not in the chat

**Whenever there are questions for the owner, or ideas, proposals or
suggestions to put to them, publish them as an artifact page, every time,
without being asked.** This covers every kind of work: new features,
improvements, builds with something unclear in them, and bug fixes. It is a
standing instruction from the repository's owner; only exceptional
circumstances that make a page unfeasible (the artifact tool is not
available, say) excuse it, and then say so.

The one exception: **one or two short questions with nothing to show** may
be asked in the chat, in the format above. If either question needs more
than a line or two, or a picture would help, it goes in a page.

What the page holds:

- The same format as above: numbered questions or decisions, lettered
  options.
- **The recommendation lives inside the recommended option**, both in how
  it looks and in words: that option stands out from the others at a
  glance (a badge and a highlight, on its mock-up too where it has one),
  and the word "Recommended" and the very short reason are written in it.
  Never a separate "Recommended: b" line or box beside the options.
- **A picture wherever one is relevant.** A change the owner would see in
  the app is shown as a realistic mock-up in the app's real look, at phone
  size. Anything else (behaviour, order of steps, what is stored) gets a
  simple sketch, or none if it would add nothing.
- **Every option gets its own mock-up**, not one picture for the question
  and not a picture of the recommended option only. If a question has
  options a, b and c that would look different in the app, there are three
  mock-ups, side by side or one after another, so they can be compared.
  The only options without one are those with nothing to see.
- **Choosing is done on the pictures wherever possible.** Where the
  options have mock-ups or sketches, the owner taps the picture itself to
  select that option, and the chosen one is plainly marked; no separate
  list of choices repeated in text underneath. Options with nothing to
  show are chosen from their text.
- Every question also offers "none of these", and has a box for a comment
  or note.
- **One button that copies every answer and note to the clipboard** as a
  short text ("1a, 2b: note…") the owner pastes back into the chat. It
  must work on a phone, and show what was copied or that copying failed.
- Selections and notes survive a reload of the page.

Follow-up questions go in **a new version of the same page**, not a new
page and not the chat: the earlier decisions stay on it, shown as settled
with the owner's notes, and the new questions carry on the numbering.

**No long text in the chat. Whenever a page is shared or updated, the
reply in the chat is one very short sentence and the link to the page,
and nothing else.** This holds every time: for the first version, and for
every later version after the owner pastes answers or asks for a change.
Do not repeat or summarise the questions, the options, the reasoning or
what changed on the page in the chat; anything worth saying goes on the
page itself.

## How to propose fixes

Whenever there is more than one way to fix something, whether in answer to a
question, in a plan, or offered unprompted, set them out the same way as
questions, every time, and in an artifact page as the section above says:

- Each thing to decide is numbered 1, 2, 3, running on across any headings.
- The fixes for it are lettered a, b, c under it, one fix per letter, so
  the owner can answer "1b, 2a" and be understood. Never 1.1 and 1.2.
- Each fix says, in the same plain terms as above, what changes for the
  people using the app and what it costs or gives up.
- The recommendation is part of the recommended fix itself, never a
  separate line or item after the fixes: that fix is labelled
  "Recommended" and carries the very short reason why.

Where there is only one sensible fix, still say which it is and why, rather
than presenting it as a list of one.

## Reproduce before fixing

**When a bug is reported, see it happen before changing code,** above all
one that shows only on a phone, or only on one of two screens that should
behave alike. Run the real app, put the working case and the broken case
side by side, and measure the difference. A fix reasoned from reading the
code alone and pushed untested costs the owner a deploy and a test on
their own phone to learn it did not work.

- `docs/DEBUGGING-on-a-phone.md` has the method that works here: the
  built app with its own server, an emulated phone, both kinds of phone
  keyboard simulated, and what to measure.
- If a fix has already failed once, stop guessing and do this next.
- When reporting, say what was checked this way and what still needs a
  real device.
