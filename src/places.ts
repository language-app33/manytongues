/*
 * Where you are, and what you can do there (0.574).
 *
 * The You menu has two controls for it. At its top, "Your spaces" (or, for
 * the App admin, "Where you are"): the places you can be. For the App
 * admin that is Super admin, a level above every space, then each of
 * their own spaces, then the space they opened from Super admin → Spaces
 * while they are in it. At its foot, the toggle of the space's own modes:
 * Learning, Teaching, Admin. At Super admin there is no space, so no
 * toggle.
 *
 * Pure, with nothing imported, so the rules can be tested on their own.
 */

export type Mode = "learn" | "teach" | "admin" | "super";

export interface PlaceSpace {
  id: string;
  slug: string;
  name: string;
  /** A stored picture's hash, or a data URL from the address (0.576). */
  logo?: string;
  logoData?: string;
}

export interface Place {
  /** "super", or a space's id. */
  id: string;
  slug: string;
  label: string;
  logo?: string;
  logoData?: string;
  /** The space opened from Super admin, not one of yours (0.576). */
  opened?: boolean;
}

export function placeRows(o: {
  /** The App admin. */
  admin: boolean;
  /** A space admin, of the space here. */
  orgAdmin: boolean;
  teaches: boolean;
  /** The App admin at an opened space's address: none of their own. */
  trying: boolean;
  /** The current mode. */
  space: Mode | string;
  /** The account's own spaces. */
  mine: PlaceSpace[];
  /** The opened space, when trying. */
  opened: PlaceSpace | null;
  /** The space at the address. */
  hereId: string;
}): {
  /** The control at the top. [] when there is nothing to choose. */
  places: Place[];
  /** Which of them is current: "super", or a space id. */
  placeNow: string;
  /** The toggle at the foot. [] at Super admin. */
  modes: Mode[];
} {
  const asPlace = (s: PlaceSpace): Place => ({ id: s.id, slug: s.slug, label: s.name, logo: s.logo, logoData: s.logoData });
  const placeNow = o.space === "super" ? "super" : o.hereId;

  let places: Place[];
  if (o.admin) {
    places = [{ id: "super", slug: "", label: "Super admin" } as Place]
      .concat(o.mine.map(asPlace))
      .concat(o.trying && o.opened && !o.mine.some((s) => s.id === o.opened!.id) ? [{ ...asPlace(o.opened), opened: true }] : []);
  } else {
    places = o.mine.length > 1 ? o.mine.map(asPlace) : [];
  }

  let modes: Mode[];
  if (o.space === "super") modes = [];
  else if (o.trying) modes = ["learn", "teach", "admin"];
  else {
    const runs = o.admin || o.orgAdmin;
    modes = ["learn"];
    if (o.teaches || runs) modes.push("teach");
    if (runs) modes.push("admin");
  }
  return { places, placeNow, modes };
}

/* ------------------------------------------------------------------
   Where you are, as one line and one sheet (0.601)

   The You menu's spaces list, its mode toggle, its language ticks and
   Learning's corner button were four controls for one question. They are
   now one line at the top of every page, saying where you are, and one
   sheet behind it. `placeRows` above still decides what exists; this says
   how the sheet lists it and what the line reads.
   ------------------------------------------------------------------ */

export const MODE_LABEL: Record<Mode, string> = { learn: "Learning", teach: "Teaching", admin: "Admin", super: "Super admin" };

/** One row of the sheet: Super admin, all your spaces, or one space. */
export interface WhereRow {
  /** "super", "all", or a space's id. */
  id: string;
  slug: string;
  label: string;
  logo?: string;
  logoData?: string;
  /** The space opened from Super admin, not one of yours. */
  opened?: boolean;
  /** The space at the address: the only one whose modes are known here. */
  here?: boolean;
  /** What you can do there, offered under the row. Only for the space
      here: what you may do in your other spaces is not known until you
      are in them. Empty for a row that is one place only. */
  modes: Mode[];
  /** One plain line under the name. */
  what: string;
}

export function whereRows(o: Parameters<typeof placeRows>[0] & {
  /** The space Learning is narrowed to, or "" for all of them. */
  filter: string;
  /** How many languages there are to choose between, in this mode. */
  langs: number;
}): {
  rows: WhereRow[];
  /** Which row is current. */
  now: string;
  /** What the line at the top reads, before any languages. */
  label: string;
  /** The same in its two parts, so a long place can be cut short while
      the mode stays whole: either may be "". */
  parts: { place: string; mode: string };
  /** Whether there is anything to choose, so a line at all. */
  shown: boolean;
  /** Whether Learning reads across more than one space. */
  multi: boolean;
} {
  const { places } = placeRows(o);
  /* What you can do here, wherever you are looking from: at Super admin
     too, so the way back to your space's Teaching is one tap. */
  const modesHere = placeRows({ ...o, space: o.space === "super" ? "learn" : o.space }).modes;
  const multi = !o.trying && o.mine.length > 1;
  const filter = multi && o.mine.some((s) => s.id === o.filter) ? o.filter : "";

  const rows: WhereRow[] = [];
  if (o.admin) rows.push({ id: "super", slug: "", label: MODE_LABEL.super, modes: [], what: "Every space: spaces, people, reports and backups." });
  if (multi) rows.push({ id: "all", slug: "", label: "All your spaces", modes: [], what: "Learning across every space you are in." });

  let spaces = places.filter((p) => p.id !== "super");
  if (!spaces.length) {
    const here = (o.opened && o.opened.id === o.hereId ? o.opened : null) || o.mine.find((s) => s.id === o.hereId) || null;
    if (here) spaces = [{ id: here.id, slug: here.slug, label: here.name, logo: here.logo, logoData: here.logoData }];
    /* An account the server has not yet named a space for still has its
       modes, and they need a row to sit under. */
    else if (modesHere.length > 1) spaces = [{ id: o.hereId, slug: "", label: "Your space" }];
  }
  for (const p of spaces) {
    const here = p.id === o.hereId;
    const runs = o.orgAdmin || (o.admin && o.trying);
    const what = p.opened
      ? "Opened from Super admin. Practice here stays on this device."
      : !here
      ? "Another of your spaces."
      : runs || (o.admin && modesHere.includes("admin"))
      ? "You run this space."
      : o.teaches
      ? "You teach here."
      : "You learn here.";
    rows.push({ ...p, here, modes: here && modesHere.length > 1 ? modesHere : [], what });
  }

  const now = o.space === "super" ? "super" : o.space === "learn" && multi ? filter || "all" : o.hereId;
  const current = rows.find((r) => r.id === now);
  const placeName = current ? current.label : "";
  const many = rows.length > 1;
  const mode = o.space === "super" ? "" : MODE_LABEL[o.space as Mode] || "";
  const parts = { place: many || !mode ? placeName : "", mode };
  const label = [parts.place, parts.mode].filter(Boolean).join(" · ");
  const shown = many || modesHere.length > 1 || o.langs > 1 || o.trying;
  return { rows, now, label, parts, shown, multi };
}

/**
 * The languages part of the line, once some are switched off: "Arabic
 * only", or "2 of 3 languages". Nothing while every one is on, or when
 * there is only one.
 */
export function langsSummary(onNames: string[], total: number): string {
  if (total < 2 || onNames.length >= total || !onNames.length) return "";
  return onNames.length === 1 ? `${onNames[0]} only` : `${onNames.length} of ${total} languages`;
}
