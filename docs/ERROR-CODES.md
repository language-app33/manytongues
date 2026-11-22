# Error codes in brackets

Since 0.669 the app never says "server" to the people using it. A fault on
our side reads:

> Something went wrong on our side. Try again in a moment. (500)

The code in brackets is for whoever runs the site. This is what each one
used to say, and what to check.

| Code | What happened | What to check |
|---|---|---|
| `404` | Something other than the app's own server answered the request. | That the site runs `server/index.js` and that nothing in front of it (a proxy, a redirect, a static host) answers `/api/courses` instead. |
| `500`, or another number | The server answered with that status and no explanation of its own. | The site's function log for the time of the screenshot. |
| `error` | The server caught an error of its own and said so. | The site's function log. |
| `storage` | The server can't reach its storage. | That `DATA_DIR` points at a writable directory (a volume on Railway). |

Two messages have no code:

- **"The app has just been updated and this part isn't ready yet."** The
  app on the device is newer than the server: it asked for something the
  server does not know (`unknown-action`). It clears once the deploy
  finishes. If it does not, deploy the current `server/api/courses.js` and
  restart.
- **"No connection"**, in the bar at the foot of the screen. A request
  could not be made or timed out, a gateway answered 502, 503 or 504 (a
  server restarting during a deploy), or the answer was not the app's own
  (often a wifi login page). The rule is `noConnection` in `src/net.ts`.
