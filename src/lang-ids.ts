/*
 * Language ids that have been renamed, old to new.
 *
 * An id is stored everywhere a language is named — on every card and form,
 * in settings, on a course, as the key of a teacher's numbers — so renaming
 * one in the packs strands everything written before. This is the list of
 * such renames, applied wherever stored material comes in: the document
 * read from this device, a sync pull, an import, a server reply, and once
 * over the server's own store at startup.
 *
 * Vietnamese was "vi-Hue" while the pack taught the Huế accent. It teaches
 * no one accent now, so it is plain "vi".
 */
export const RENAMED_LANGS: Record<string, string> = {
  "vi-Hue": "vi",
};

/**
 * The value with every renamed id replaced: as a string value, and as an
 * object key. Anything else is returned as it came, and a value holding no
 * old id comes back as the same object, so a document already migrated
 * costs one walk and no copies.
 */
export function renameLangIds<T>(value: T): T {
  if (typeof value === "string") {
    return (Object.prototype.hasOwnProperty.call(RENAMED_LANGS, value) ? RENAMED_LANGS[value] : value) as T;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const n = renameLangIds(v);
      if (n !== v) changed = true;
      return n;
    });
    return (changed ? out : value) as T;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nk = renameLangIds(k);
      const nv = renameLangIds(v);
      if (nk !== k || nv !== v) changed = true;
      /* A document that somehow holds both keys keeps the new one's value. */
      if (nk !== k && Object.prototype.hasOwnProperty.call(value, nk)) continue;
      out[nk] = nv;
    }
    return (changed ? out : value) as T;
  }
  return value;
}
