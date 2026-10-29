/*
 * The server's half of a language id rename — see src/lang-ids.ts.
 *
 * Run once at startup, before the server listens: every stored document
 * that names an old id is rewritten to name the new one, through the
 * store's own atomic write. A document that does not mention an old id is
 * read and left alone, so a second run finds nothing to do — but it still
 * reads everything, which is why a marker file records the renames already
 * applied and a restart skips them.
 *
 * Only the text is searched first, for the id in quotes, so recordings and
 * images — large, and never holding one — are not parsed.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RENAMED_LANGS, renameLangIds } from "../src/lang-ids.ts";
import { dataRoot, getStore } from "./store.js";

const MARKER = "renamed-langs.json";

/**
 * @param {string} [root]
 * @returns {Promise<number>} How many documents were rewritten.
 */
export async function renameStoredLangs(root = dataRoot) {
  const olds = Object.keys(RENAMED_LANGS);
  const markerAt = path.join(root, MARKER);
  /** @type {string[]} */
  let done = [];
  try {
    done = JSON.parse(await readFile(markerAt, "utf8"));
  } catch (e) {
    /* No marker: nothing has been renamed yet. */
  }
  const wanted = olds.filter((o) => !done.includes(o));
  if (!wanted.length) return 0;

  let rewritten = 0;
  /** @type {import("node:fs").Dirent[]} */
  let stores = [];
  try {
    stores = await readdir(root, { withFileTypes: true });
  } catch (e) {
    /* No data directory yet: a fresh server has nothing to rename. */
  }
  for (const entry of stores) {
    if (!entry.isDirectory()) continue;
    const store = getStore(decodeURIComponent(entry.name));
    for (const file of await readdir(path.join(root, entry.name))) {
      /* The kept previous copy and any half-written temporary are not
         documents of their own. */
      if (file.endsWith(".prev") || file.endsWith(".tmp")) continue;
      const key = decodeURIComponent(file);
      const text = await store.get(key);
      if (!text || !wanted.some((o) => text.includes(JSON.stringify(o)))) continue;
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        continue;
      }
      const renamed = renameLangIds(parsed);
      if (renamed === parsed) continue;
      await store.set(key, JSON.stringify(renamed));
      rewritten++;
    }
  }
  await writeFile(markerAt, JSON.stringify([...done, ...wanted]));
  return rewritten;
}
