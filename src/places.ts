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
