/*
 * Sign-in links (0.638): a student's private link is their space's address
 * with their sign-in key after `#`, which browsers never send to a server.
 * Pure functions only: nothing here reads the window or the app.
 */

/* A sign-in key as the server makes it: words and a tail, joined by dashes. */
const KEY_SHAPE = /^[a-z0-9]+(-[a-z0-9]+){2,7}$/;

/** The private link that signs a student in: the space's address, the key after #. */
export function signInLink(origin: string, slug: string, key: string): string {
  return `${origin}/${slug}#key=${key}`;
}

/** The key in an address's `#…` part, or "" when it holds none. */
export function keyFromHash(hash: string): string {
  const m = /^#key=([^&]+)$/.exec(hash || "");
  let key = "";
  try {
    key = m ? decodeURIComponent(m[1]).trim() : "";
  } catch (e) {
    return "";
  }
  return KEY_SHAPE.test(key) ? key : "";
}

/** The key in a pasted sign-in link, or "" when the text is not one. */
export function keyFromLink(text: string): string {
  try {
    return keyFromHash(new URL(text.trim()).hash);
  } catch (e) {
    return "";
  }
}
