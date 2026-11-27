# Finding a bug that only shows on a phone

How the "keyboard hides the feedback box" bug (0.647–0.648) was finally
found, written down so the next one of its kind takes one round rather
than three.

## What went wrong the first two times

Both early fixes were reasoned from reading the code, and both were
pushed without having seen the bug happen. The first changed the screen on
a guess. The second copied something a session does that turned out to
make no difference. Each cost the owner a deploy and a test on their own
phone to learn it had not worked.

The third round took one step the first two skipped: **run the real app,
put the working case and the broken case side by side, and measure.** The
cause was visible in the first set of numbers.

## The rule

When something "works here but not there" on a phone, do not change code
until both cases have been run and measured, and the difference between
them is a number rather than a theory. Then make the fix, run the same
measurement again, and report what was and was not checked. If a fix has
already failed once, stop reasoning and do this.

## The method

1. **Run the built app locally with its real server.** `npm run build`,
   then start the server with a throwaway data folder and an admin key:

   ```bash
   DATA_DIR=<scratch>/data ADMIN_KEY=k PORT=3111 node server/index.js
   ```

2. **Seed it through the API**, the way `tests/spaces.test.mjs` does:
   `signup`, `claim-admin`, `create-course`, `admin-create-user` (a
   teacher and a student), `create-deck`, `attach-deck`, and a few
   `save-card` calls. Keep the student's sign-in key.

3. **Drive it with Playwright on an emulated phone** (`devices['iPhone
   13']`, service workers blocked). Sign in with "I already have a sign-in
   key", tick the "saved my key" box if it shows, dismiss "Not now".

4. **Reach both cases by tapping, as a person would.** For this bug: You ›
   Share feedback from Home, and Start session › I don't know › Flag a
   problem.

5. **Measure the same things in both**, before and after the thing that
   triggers the bug. For a layout bug: the window height, the visual
   viewport's height and offset, the page's scroll height, and the top
   and bottom of each element that matters (the screen, its scrolling
   body with `scrollTop`, `scrollHeight` and `clientHeight`, the box, the
   pinned footer), plus the classes on the app root. Print them on one
   line per case so they can be compared by eye.

6. **Simulate the phone's keyboard both ways**, because the two kinds of
   phone do different things and a desktop browser has no keyboard:

   - *Android style*: the window itself shrinks. Focus the box, then
     `page.setViewportSize({ width: 390, height: 364 })`.
   - *iPhone style*: the window keeps its height and only the visual
     viewport shrinks. Override `visualViewport.height` (and `offsetTop`,
     to imitate the view being shifted) with `Object.defineProperty`,
     focus the box, and dispatch `resize` / `scroll` on
     `window.visualViewport`.

   Neither is a real keyboard. They show how the app's own layout
   responds, which is where the bug was, but the phone's own scrolling is
   not imitated. Say so when reporting, and ask for a check on a real
   phone.

7. **Fix, rebuild, and run the same script.** The fix is right when both
   cases print the same, good numbers, and go back to normal when the
   keyboard goes.

## What the numbers showed here

Flag a problem has four options, so its screen was taller than the window
(`scrollHeight` 758 against `clientHeight` 596) and the session page
under it was taller too: the phone had something to scroll to uncover the
box. Share feedback has two options and fitted exactly (596 against 596)
over a page that also fitted: nothing could scroll, and the box stayed
under the keyboard. Same component, different amount of content.

## Things worth knowing next time

- **The same component is not the same behaviour.** What is under it, and
  how much is in it, can decide what a phone does with it.
- **An iPhone's keyboard covers the page; Android's shrinks it.** With
  `interactive-widget=resizes-content` (in `index.html`) Android resizes
  the window, so `useSoftKeyboard` never reports a keyboard there. Its
  `kb-open` treatment is in practice an iPhone-only path.
- **Do not rely on the phone to scroll a box into view** inside a
  full-window screen. A screen with a box to type in should fit itself to
  the visual viewport and place the box itself, as `ReportScreen` does.
- **A pinned footer inside a scrolling area can cover the box** once the
  area is squeezed. Measure the footer too.
- **A `Screen` draws once in place and again at the app's root**, so a
  ref read in a mount effect points at an element that is no longer on
  the page. Hold the element in state (`ref={setBox}`) and key the effect
  on it.

## A real WebKit

An emulated iPhone in Playwright is Chromium with an iPhone's size and
name. It shows the app's layout; it says nothing about what Safari's
engine makes of the code. For that there is `scripts/webkit-driver.mjs`
(0.730), which drives WebKitGTK, the same engine built for Linux, with
real clicks:

```bash
apt-get install -y webkit2gtk-driver xvfb
```

Then start the built app as in step 1 above and write a script against
`open()` from that file; its header shows how. Things it settles that
Chromium cannot:

- **Whether the app starts at all**, and what the engine logs as it runs.
- **What a tap is allowed to do**: sound without a tap is refused there as
  it is on an iPhone, so "does this still play after the wait" can be
  measured.
- **A private window.** Its windows are private ones, and a private
  window in WebKit refuses to keep a recording or picture on the device.

Things it does not: the on-screen keyboard, the notch and home bar, the
home-screen install, and anything a particular iOS version gets wrong.
Those still need a phone, and the report should say so.

An **older** Safari cannot be run at all. What can be done is to find what
it would refuse: `tests/old-safari.test.mjs` holds the one such thing
found so far.
