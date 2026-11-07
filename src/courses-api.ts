/*
 * Talking to the courses endpoint.
 *
 * Everything needs the sign-in key, so it is held here rather than passed
 * around. Each call returns the parsed body; anything that isn't a 2xx
 * throws with the server's own error string, which the screens turn into
 * something a person can read.
 */
import type { Card, Feedback, Flag, LangId, User } from "./types.ts";
import { renameLangIds } from "./lang-ids.ts";

const ENDPOINT = "/api/courses";
const KEY_STORE = "arabic-account";

let currentKey = "";

/** @param key  Null when there is no account: `|| ""` takes it. */
export function setKey(key?: string | null) {
  currentKey = key || "";
}


/** A space as the app is told of it. */
export interface OrgCard {
  id: string;
  slug: string;
  name: string;
  logo: string;
  colour: string;
}

/* The account as stored, parsed once and kept current by loadAccount,
   saveAccount and clearAccount: call() must not parse it on every
   request. */
let accountNow: (User & { key: string }) | null = null;

/* The account lives beside the trainer's own data rather than inside it,
   so signing in on a new device doesn't have to wait for a sync. */
export function loadAccount(): (User & { key: string }) | null {
  try {
    const raw = localStorage.getItem(KEY_STORE);
    accountNow = raw ? JSON.parse(raw) : null;
  } catch (e) {
    accountNow = null;
  }
  return accountNow;
}
loadAccount();

/*
 * The space every request acts in (0.582), sent as x-org.
 *
 * Known at once for a member (the space at the address when it is one of
 * theirs, else the one whoami landed them in) and for an App admin at one
 * of their own addresses or at the plain address. Not yet known for an App
 * admin at another space's address, until org-info has said which space
 * that is: a request then WAITS rather than leaving without it, because a
 * request without it acts in the admin's own first space.
 */
let addressOrg = ""; // what the address lookup said; "" until it has
let lookupFailed: Error | null = null;
let waiters: { ok: (id: string) => void; no: (e: Error) => void }[] = [];

function slugHere(): string {
  if (typeof window === "undefined" || !window.location || !window.location.pathname) return "";
  return (window.location.pathname.split("/")[1] || "").toLowerCase();
}
function orgsOf(me: any): { id: string; slug: string }[] {
  return Array.isArray(me.orgs) && me.orgs.length ? me.orgs : me.org && typeof me.org === "object" ? [me.org] : [];
}

/**
 * The acting space's id; "" when the server should use its own default
 * (nobody signed in, or an admin at the plain address); null when it is
 * not yet known and a request must wait.
 */
export function actingSpace(): string | null {
  if (addressOrg) return addressOrg;
  const me: any = accountNow;
  if (!me) return "";
  const here = slugHere();
  const own = orgsOf(me).find((o) => o && o.slug === here);
  if (me.admin) return own ? own.id : here ? null : "";
  if (own) return own.id;
  return me.org && typeof me.org === "object" ? me.org.id : "";
}

/** The acting space, for keying what is kept on the device: "" while unknown. */
export const currentOrg = () => actingSpace() || "";

/** What the address lookup said the space at the address is. */
export function setAddressOrg(id?: string | null) {
  addressOrg = id || "";
  lookupFailed = null;
  if (addressOrg) {
    const w = waiters;
    waiters = [];
    for (const x of w) x.ok(addressOrg);
  }
}
/** The address lookup failed: every request waiting on it fails too. The
    next one waits for the next attempt, unless there is no such space,
    when every request fails with that. */
export function spaceLookupFailed(e: Error) {
  lookupFailed = e && e.message === "no-space" ? e : null;
  const w = waiters;
  waiters = [];
  for (const x of w) x.no(e);
}
function awaitSpace(): Promise<string> {
  if (lookupFailed) return Promise.reject(lookupFailed);
  return new Promise((ok, no) => waiters.push({ ok, no }));
}

/*
 * The App admin at an address that is none of their spaces (0.574): the
 * slug of the space they are trying, or "". Read once at start, because
 * the practice document's key depends on it.
 */
export function tryingSpace(): string {
  const me: any = loadAccount();
  if (!me || !me.admin || typeof window === "undefined") return "";
  const mine = orgsOf(me);
  const here = slugHere();
  if (!here || !mine.length) return "";
  return mine.some((o) => o && o.slug === here) ? "" : here;
}

/* Everything kept on the device while trying a space (0.574) ends in this,
   so leaving it can drop the lot. */
export const trialSuffix = (slug: string) => (slug ? `:trying:${slug}` : "");

/** Drop what trying `slug` kept on the device; every trial when "". */
export function dropTrial(slug = "") {
  try {
    const gone: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (slug ? k.endsWith(trialSuffix(slug)) : k.includes(":trying:")) gone.push(k);
    }
    for (const k of gone) localStorage.removeItem(k);
  } catch (e) {
    /* private browsing: nothing kept to drop */
  }
}

export function saveAccount(account: (User & { key: string }) | null) {
  try {
    localStorage.setItem(KEY_STORE, JSON.stringify(account));
  } catch (e) {
    /* private browsing — the account lasts for the session only */
  }
  accountNow = account;
  setKey(account && account.key);
}

export function clearAccount() {
  try {
    localStorage.removeItem(KEY_STORE);
  } catch (e) {
    /* nothing stored */
  }
  accountNow = null;
  setKey("");
}

/* A request that never answers is worse than one that fails: the screen sits
   on "Working…" with its buttons greyed out until the app is reloaded. Give
   every call a deadline and treat passing it the same as being offline. */
const CALL_TIMEOUT_MS = 20000;

/* The ETag each list last came with, per address, key and space (0.580,
   audit finding 17). Sent back as If-None-Match; a 304 means nothing moved
   and the call answers `{ unchanged: true }` instead of the list. Only in
   memory: a reload asks for everything once. */
const ETAGS = new Map<string, string>();
/** For tests: forget every remembered ETag. */
export const forgetEtags = () => ETAGS.clear();

/**
 * One request to the endpoint.
 *
 * `key` overrides the held sign-in key — passing "" makes the call
 * deliberately anonymous, which signing up needs and nothing else does.
 *
 * The answer is `any` on purpose. Every action returns a different shape
 * and the wrappers below say which; describing them all here would be one
 * union nobody could read, and each caller already knows what it asked
 * for.
 */
async function call(
  action: string,
  { body, params, key, org }: { body?: unknown; params?: Record<string, string>; key?: string; org?: string } = {},
): Promise<any> {
  const url = new URL(ENDPOINT, window.location.origin);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);

  const headers: Record<string, string> = { "content-type": "application/json" };
  const use = key !== undefined ? key : currentKey;
  if (use) headers["x-key"] = use;
  /* One call can name its own space: Super admin acting on someone
     elsewhere (0.547). */
  let space = org || "";
  /* An anonymous call (key "") is sign-up or the address lookup itself,
     which cannot wait for the lookup (0.582). */
  if (!space && key !== "") {
    const known = actingSpace();
    space = known === null ? await awaitSpace() : known;
  }
  if (space) headers["x-org"] = space;
  const tagAt = body ? "" : `${url.toString()}|${use || ""}|${headers["x-org"] || ""}`;
  const tag = tagAt ? ETAGS.get(tagAt) : undefined;
  if (tag) headers["if-none-match"] = tag;

  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), CALL_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url.toString(), {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: abort.signal,
    });
  } catch (e) {
    throw new Error("offline");
  } finally {
    clearTimeout(deadline);
  }

  /* Read the body as text and parse it here rather than calling res.json()
     directly. A failure that never reached the function — a missing
     redirect serving index.html, a platform error page — has a body that
     isn't JSON, and res.json() throwing on it would lose the status code
     along with every clue about what actually happened. */
  if (res.status === 304 && tag) return { unchanged: true };
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = null;
  }
  if (data === null || typeof data !== "object") {
    throw new Error(res.ok ? "bad-response" : `http-${res.status}`);
  }
  /* With the whole answer attached: some errors say more than their code —
     "other-space" names the space the key belongs to (0.543). */
  if (!res.ok) throw Object.assign(new Error(data.error || `http-${res.status}`), { data });
  const etag = tagAt && res.headers && res.headers.get ? res.headers.get("etag") : null;
  if (tagAt) {
    if (etag) ETAGS.set(tagAt, etag);
    else ETAGS.delete(tagAt);
  }
  /* Material written under a language's old id, by a device still on an
     older build, reads as the language it is now. See lang-ids.ts. */
  return renameLangIds(data);
}

/* ---- accounts ---- */
/* With an invite or course code, which decides the space; `org` is the
   space whose address is open, so a code from elsewhere is caught (0.543). */
export const signUp = (displayName: string, code?: string, org?: string) =>
  call("signup", { body: { displayName, code: code || "", org: org || "" }, key: "" });
/* `org` is the space to land in, when the account may use it: the address
   open, or the one last used on this device. `code` lets an account with
   no space it may use get back in with the invitation it followed
   (memberships). */
export const whoAmI = (key: string, org?: string, code?: string) =>
  call("whoami", { key, params: { ...(org ? { org } : {}), ...(code ? { code } : {}) } });

/* The space last used on this device, for landing there at the plain
   address (memberships, 2a). Per device, like the theme. */
const LAST_SPACE = "arabic-trainer:last-space";
export function rememberSpace(id?: string | null) {
  try {
    if (id) localStorage.setItem(LAST_SPACE, id);
  } catch (e) {
    /* private browsing: the plain address lands in the first space */
  }
}
export function lastSpace(): string {
  try {
    return localStorage.getItem(LAST_SPACE) || "";
  } catch (e) {
    return "";
  }
}
/** What a space's address shows before anyone signs in. */
export const orgInfo = (slug: string): Promise<
  { ok: true; org?: OrgCard & { logoData: string; closed: boolean }; moved?: string }
> => call("org-info", { params: { slug }, key: "" });
export const rename = (displayName: string) => call("rename", { body: { displayName } });
/* "Some learning just happened." The server keeps the moment and nothing
   else — what was practiced and how it went are in the device's own
   document, which never passes through here. */
export const practiced = (orgs?: string[]) => call("practiced", { body: orgs ? { orgs } : {} });
export const claimAdmin = (adminKey: string) => call("claim-admin", { body: { adminKey } });

/* ---- flags ----
   "Something about this question is wrong." Sent by whoever hit it, read in
   Admin → Flags by whoever can fix it. The report carries a copy of the
   question rather than a pointer to the card, so it still says something
   after the card has been edited or withdrawn. */
/**
 * `language` is the id — "ar-PS" — and not the language pack that has one.
 * Passing the pack is the mistake this signature exists to refuse: it read
 * perfectly well at the call site, was accepted here, and arrived at the
 * server as "[object Object]".
 */
export type FlagReport = Pick<
  Flag,
  | "kind"
  | "note"
  | "cardId"
  | "exercise"
  | "subId"
  | "prompt"
  | "meaning"
  /* What the question did to them, where the card came from, and which
     build they were on. All optional: a report queued offline by an older
     build arrives without them, and it is still a report. */
  | "courseId"
  | "deckId"
  | "answer"
  | "verdict"
  | "expected"
  | "release"
  | "sentence"
> & {
  language: LangId;
};

export const reportFlag = (flag: FlagReport): Promise<{ ok: true; id: string }> =>
  /* My space is no course and its decks are private (0.545): a report from
     there names the card alone. */
  call("report-flag", {
    body: (flag as any).courseId === "my-space" ? { ...flag, courseId: "", deckId: "" } : flag,
  });

/* ---- courses ---- */
export const myCourses = () => call("my-courses");
export const createCourse = (title: string, language: LangId, description?: string) =>
  call("create-course", { body: { title, language, description } });
export const assignStudent = (courseId: string, handle: string) =>
  call("assign-student", { body: { courseId, handle } });
export const assignTeacher = (courseId: string, handle: string) =>
  call("assign-teacher", { body: { courseId, handle } });
export const removeMember = (courseId: string, handle: string, role: "teacher" | "student") =>
  call("remove-member", { body: { courseId, handle, role } });
export const joinCourse = (code: string) => call("join-course", { body: { code } });
/* A space's invitation, followed while signed in: adds the space to this
   account (memberships). */
export const joinSpace = (code: string) => call("join-space", { body: { code } });
export const courseDecks = (courseId: string) => call("course-decks", { params: { course: courseId } });
/* Everything a student holds in one request. Pass the version from the last
   answer and the server replies { unchanged: true } when nothing moved. */
export const myMaterial = (version?: string) =>
  call("my-material", { params: version ? { version } : {} });

/* ---- decks and cards ---- */
export const myDecks = () => call("my-decks");
export const createDeck = (title: string, description: string, lang: LangId, personal = false) =>
  call("create-deck", { body: { title, description, lang, ...(personal ? { personal: true } : {}) } });
/* ---- My space (0.545) ---- */
export const setDeckPractise = (deckId: string, practise: boolean) =>
  call("set-deck-practise", { body: { deckId, practise } });
export const copyToSpace = (deckId: string, move = false, courses: string[] = []): Promise<{ ok: true; deck: any }> =>
  call("copy-to-space", { body: { deckId, move, courses } });
export const cardToSpace = (cardId: string, deckId: string, move = false) =>
  call("card-to-space", { body: { cardId, deckId, move } });
export const renameDeck = (deckId: string, title: string) => call("rename-deck", { body: { deckId, title } });
export const deleteDeck = (deckId: string) => call("delete-deck", { body: { deckId } });
/* A locked deck keeps the cards it has: nothing added, nothing taken out. */
export const lockDeck = (deckId: string, locked: boolean) => call("lock-deck", { body: { deckId, locked } });
/* Which parts of the teacher's numbers a deck holds, by range id; the
   whole list each time. */
export const setDeckParts = (deckId: string, parts: string[]) =>
  call("set-deck-parts", { body: { deckId, parts } });
export const myCards = () => call("my-cards");
/** Who a deck may take its numbers from, owner first (0.541). */
export const numberSources = (deckId: string): Promise<{
  ok: true;
  sources: { handle: string; displayName: string; numbers: boolean; times: boolean }[];
  chosen: string;
}> => call("number-sources", { params: { deck: deckId } });
export const setDeckNumbers = (deckId: string, from: string) =>
  call("set-deck-numbers", { body: { deckId, from } });
/* The server calls this field "decks"; sending anything else means the
   card saves but never lands in a deck. */
/**
 * How a save is made, beside the card — see save-card. `touched` names the
 * fields that changed, and only those are written; `into: "changes"` sends
 * the card editor's saves to a published card's unpublished changes;
 * `walk` is a rename or a tag taken off the collection, applied by the
 * server to both of a card's versions; `status` is the one the save asks
 * for — Draft for a card made on the card screen, Ready for review for an
 * import — on the card, or on a published card's changes.
 */
export type SaveExtra = {
  touched?: string[];
  into?: "changes";
  walk?: { renames?: { from: string; to: string }[]; drops?: string[] };
  status?: "draft" | "review";
  /** A new card made in My space (0.545). */
  personal?: boolean;
  /** The decks the screen believed the card was in before this change
      (0.580): the server then applies only what was added and removed. */
  decksWere?: string[];
};
/* `org` is the space the save was made in, for one queued offline and sent
   from wherever the app is by then (0.580). */
export const saveCard = (card: Partial<Card>, decks: string[], extra: SaveExtra = {}, org?: string) =>
  call("save-card", { body: { card, decks, ...extra }, ...(org ? { org } : {}) });
/* A card's status, or its unpublished changes' — see card-status. */
export const cardStatus = (
  cardId: string,
  to: "draft" | "review" | "published" | "discard" | "unpublish",
): Promise<{ ok: true; card: Card }> => call("card-status", { body: { cardId, to } });
/* A teacher's say on the sentences a card makes: fingerprints approved,
   struck, or forgotten — see review.ts and review-card on the server. */
export const reviewCard = (
  cardId: string,
  change: { ok?: string[]; no?: string[]; clear?: string[] },
): Promise<{ ok: true; card: Card }> => call("review-card", { body: { cardId, ...change } });
/* The reports learners sent about cards this teacher can change, with the
   cards; and a report dealt with. */
export const myReports = (): Promise<{ ok: true; flags: Flag[]; cards: Card[] }> => call("my-reports");
export const dismissReports = (flagIds: string[]): Promise<{ ok: true; deleted: number }> =>
  call("dismiss-reports", { body: { flagIds } });
export const deleteCard = (cardId: string) => call("delete-card", { body: { cardId } });
export const deleteCards = (cardIds: string[]) => call("delete-cards", { body: { cardIds } });
export const deckCards = (deckId: string) => call("deck-cards", { params: { deck: deckId } });
export const attachDeck = (deckId: string, courseId: string) =>
  call("attach-deck", { body: { deckId, courseId } });
export const detachDeck = (deckId: string, courseId: string) =>
  call("detach-deck", { body: { deckId, courseId } });

/* ---- clips ---- */
/* ---- a language's numbers, and its clock ----

   One document per teacher per language, in no deck, delivered with every
   course of its language. Whole-document last-write-wins: a lexicon is one
   thing a person edits in one sitting, and merging two of them field by
   field would make a lexicon neither of them wrote. A save that would go
   backwards is refused rather than silently winning, and the answer
   carries the document that is there — see `stale-system` in explain. */
export const mySystems = (): Promise<{ ok: true; systems: any[]; signed?: Record<string, number | null> }> =>
  call("my-systems");
export const saveSystem = (
  kind: "numbers" | "times",
  system: unknown,
): Promise<{ ok: true; system: any }> => call("save-system", { body: { kind, system } });
export const deleteSystem = (kind: "numbers" | "times", languageId: LangId) =>
  call("delete-system", { body: { kind, languageId } });

export const putClip = (hash: string, data: string) => call("put-clip", { body: { hash, data } });
export const getClip = (hash: string): Promise<{ ok: true; hash: string; data: string }> =>
  call("clip", { params: { hash } });

/* A card's pictures, stored and fetched the way its recordings are. */
export const putImage = (hash: string, data: string) => call("put-image", { body: { hash, data } });
/* How big these recordings and pictures are on the server, by hash — for
   saying how much a download will take. Hashes it does not hold are left
   out. */
export const mediaSizes = (clips: string[], images: string[]): Promise<{
  ok: true;
  clips: Record<string, number>;
  images: Record<string, number>;
}> => call("media-sizes", { body: { clips, images } });
export const getImage = (hash: string): Promise<{ ok: true; hash: string; data: string }> =>
  call("image", { params: { hash } });

export const deleteAccount = () => call("delete-account", { body: {} });

/* A teacher's export: the plan for what they asked for, then its records
   chunk by chunk, the way a backup is fetched. */
export const exportPlan = (cardIds: string[], deckIds: string[], media: boolean) =>
  call("export-plan", { body: { cardIds, deckIds, media } });
export const exportChunk = (keys: string[]) => call("export-chunk", { body: { keys } });

/* ---- admin ---- */
export const adminOverview = () => call("admin-overview");
/* ---- spaces, the App admin's (0.543) ---- */
export interface OrgRow extends OrgCard {
  formerSlugs: string[];
  admins: string[];
  inviteCode: string;
  created: number;
  archived?: number;
  people: { handle: string; displayName: string }[];
}
export const adminOrgs = (): Promise<{ ok: true; orgs: OrgRow[] }> => call("admin-orgs");
/* `selfAdmin` (0.552): the App admin is the new space's admin, and no
   account or key is made; `adminName` is then ignored and `key` is empty. */
export const createOrg = (name: string, slug: string, adminName: string, logo = "", colour = "", selfAdmin = false):
  Promise<{ ok: true; org: OrgRow; admin: User; key: string }> =>
  call("admin-create-org", { body: { name, slug, adminName, logo, colour, selfAdmin } });
export const updateOrg = (id: string, change: { name?: string; slug?: string; logo?: string; colour?: string }) =>
  call("admin-update-org", { body: { id, ...change } });
export const orgAdmins = (id: string, change: { add?: string; remove?: string }) =>
  call("admin-org-admins", { body: { id, ...change } });
export const archiveOrg = (id: string, archived: boolean) =>
  call(archived ? "admin-archive-org" : "admin-reopen-org", { body: { id } });
export const deleteOrg = (id: string, confirm: string) => call("admin-delete-org", { body: { id, confirm } });
/* ---- a space's export and storage (0.546) ---- */
export interface OrgUsage {
  people: number; courses: number; decks: number; cards: number;
  recordings: number; pictures: number; bytes: number;
}
export const exportOrgManifest = (id: string) => call("admin-export-org-manifest", { body: { id } });
export const orgUsage = (id: string): Promise<{ ok: true; usage: OrgUsage }> => call("admin-org-usage", { body: { id } });
/* ---- running a space (0.544) ---- */
export const newInvite = (): Promise<{ ok: true; inviteCode: string }> => call("admin-new-invite", { body: {} });
export const suspendUser = (handle: string, org?: string) => call("admin-suspend-user", { body: { handle }, org });
export const reactivateUser = (handle: string, org?: string) => call("admin-reactivate-user", { body: { handle }, org });
/* Off a space's list, under its Former members (0.578): their account and
   other spaces stay. */
export const removeFromSpace = (handle: string, org?: string) => call("admin-remove-member", { body: { handle }, org });
/* Across the whole app, the super admin's alone (0.578). */
export const suspendApp = (handle: string) => call("admin-suspend-app", { body: { handle } });
export const liftApp = (handle: string) => call("admin-lift-app", { body: { handle } });
/* ---- Super admin (0.547) ---- */
export type SuperOrg = { id: string; name: string; slug: string; admins: string[]; archived: boolean };
export const everyone = (): Promise<{ ok: true; orgs: SuperOrg[]; people: (User & { org: string; orgs?: string[]; suspendedIn?: Record<string, unknown> })[] }> =>
  call("admin-everyone");
export const allReports = (): Promise<{ ok: true; orgs: SuperOrg[]; flags: (Flag & { org: string })[]; feedback?: Feedback[] }> =>
  call("admin-all-reports");
/* Feedback about the app (0.552): anyone signed in sends it; the App admin
   alone reads and dismisses it. */
export const sendFeedback = (f: { kind: Feedback["kind"]; note: string; screen: string; release?: string }): Promise<{ ok: true; id: string }> =>
  call("send-feedback", { body: f });
export const deleteFeedback = (ids: string[]) => call("admin-delete-feedback", { body: { ids } });
/* Deleting a former member for good (0.552): their account if it is still
   there, their decks and cards, and their entry on Former members. */
export const purgeFormer = (handle: string) => call("admin-purge-former", { body: { handle } });
export const deleteFlagsIn = (flagIds: string[], org: string) =>
  call("admin-delete-flags", { body: { flagIds }, org });
export const handOver = (from: string, to: string) => call("admin-hand-over", { body: { from, to } });
export const removeFormer = (handle: string) => call("admin-remove-former", { body: { handle } });
export const keySaved = () => call("key-saved", { body: {} });
/* Which space to leave, when the account is in several. */
export const leaveSpace = (org?: string) => call("leave-space", { body: {}, org });
export const backupManifest = () => call("admin-backup-manifest");
export const backupChunk = (keys: string[]) => call("admin-backup-chunk", { body: { keys } });
export const restoreChunk = (records: Record<string, unknown>) => call("admin-restore-chunk", { body: { records } });

/* Clearing what a backup would have held. Carries the deploy's admin key as
   well as the signed-in administrator: this is the one call that removes
   things wholesale, and being signed in as an administrator is a thing a
   borrowed phone is. */
export const clearData = (adminKey: string, parts: string[]) => call("admin-clear", { body: { adminKey, parts } });

/* `roles` is a list because someone can teach a course and study it, and
   asking for both when the person is made saves going back to add the
   second by hand. */
export const createUser = (displayName: string, courseId: string, roles: ("teacher" | "student")[]): Promise<any> =>
  call("admin-create-user", { body: { displayName, courseId, roles } });
export const reissueKey = (handle: string, org?: string) => call("admin-reissue-key", { body: { handle }, org });
/* Super admin: an existing person into a space, with no new key. */
export const addMember = (handle: string, org: string): Promise<{ ok: true; orgs: string[] }> =>
  call("admin-add-member", { body: { handle, org } });
export const deleteUser = (handle: string, org?: string) => call("admin-delete-user", { body: { handle }, org });
export const newCourseCode = (courseId: string, which: "teacher" | "student") =>
  call("admin-new-code", { body: { courseId, which } });
export const deleteCourse = (courseId: string) => call("admin-delete-course", { body: { courseId } });
export const renameCourse = (courseId: string, title: string) =>
  call("admin-rename-course", { body: { courseId, title } });
export const setCourseLanguage = (courseId: string, language: LangId) =>
  call("admin-course-language", { body: { courseId, language } });
/* Flags are read with the rest of the overview; this is the only thing done
   to them. Dealt with means dealt with — there is nothing to keep. */
export const deleteFlags = (flagIds: string[]): Promise<{ ok: true; deleted: number }> =>
  call("admin-delete-flags", { body: { flagIds } });
/* One card, fetched when a report about it is opened. Admin lists decks
   rather than cards, so it holds none of them until one is asked for. */
export const adminCard = (cardId: string): Promise<{ ok: true; card: Card }> =>
  call("admin-card", { params: { card: cardId } });

/* Turn a server error into something worth reading. */
export function explain(err: unknown): string {
  /* An Error's message, or whatever was thrown. The narrowing is what the
     old `err && err.message` meant: anything without a message stringifies
     as itself. */
  const m = String(
    (err && typeof err === "object" && "message" in err && err.message) || err
  );
  if (m === "unknown-action")
    return (
      "This part of the app is newer than the server. Deploy the current " +
      "server/api/courses.js and restart it."
    );

  /* An answer that wasn't the function's own. The status is the only clue
     the app has, and each of these points at a different thing to check,
     so they are worth spelling out rather than showing a bare number. */
  if (m.startsWith("http-")) {
    const status = m.slice("http-".length);
    if (status === "404")
      return (
        "The server has no /api/courses endpoint. Either it isn't running " +
        "the app's own server, or something else is answering for it."
      );
    if (status === "502" || status === "503" || status === "504")
      return "The server didn't answer. Give it a moment and try again.";
    return `The server answered ${status}. Check the site's function log.`;
  }

  return (
    {
      offline: "Can't reach the server. Your own cards still work.",
      "bad-key": "That sign-in key isn't recognised.",
      "bad-code": "Nothing has that code. Check it with whoever gave it to you.",
      "code-required": "You need a code to join: an invitation link, or a course code from your teacher.",
      "other-space": "That belongs to another space.",
      "trying-space": "You're trying this space, not joining it.",
      /* A save that could not be sent or kept (0.580). */
      "device-full": "This device's storage is full, so the card could not be kept. Free some space and save again.",
      "trying-space-save": "You are only trying this space; nothing can be saved here.",
      "suspended-app": "Your account is suspended. Ask the super admin.",
      "suspended-here": "You're suspended in that space. Ask its admin to let you back in.",
      "account-exists": "Only the super admin can delete an account, from Super admin → People.",
      "admin-stays": "The super admin can't leave their first space.",
      "space-closed": "This space is closed.",
      "suspended": "You're not in any space right now. Ask your space's admin, or use an invitation link or a course code.",
      "many-spaces": "This person is in more than one space, so only the super admin can give them a new key.",
      "removed": "You were removed from that space. Ask its admin to let you back in.",
      "no-space": "There's no space at this address.",
      "slug-taken": "That address is taken. Addresses are never reused.",
      "slug-invalid": "An address is 3 to 40 lower-case letters, digits and dashes, starting with a letter, and some words are kept for the app.",
      "not-in-space": "That person isn't in this space.",
      "own-space": "You can't close or delete a space your own account is in.",
      "not-reportable": "That's your own card. You can change it in My space.",
      "personal-deck": "A deck in My space can't go on a course. Copy it to the space first.",
      "personal-card": "A card in My space can't go in a deck of the space. Copy its deck to the space first.",
      "confirm-name": "Type the space's name exactly to confirm.",
      "admin-only": "Only the administrator can do that.",
      "not-allowed": "That administrator key isn't right.",
      "not-yours": "That deck belongs to another teacher.",
      "not-teaching": "You aren't teaching that course.",
      "no-deck": "That deck no longer exists.",
      "deck-locked": "That deck is locked. Unlock it in its settings first.",
      "no-user": "No account with that handle.",
      "no-card": "That card no longer exists.",
      "stale-system":
        "Somebody else saved these numbers after you opened them, so this " +
        "save was not made. Open them again to see what is there now.",
      "not-a-system": "That isn't a number system this app can read.",
      "no-system": "There are no numbers saved for that language yet.",
      "no-language": "Say which language these numbers are for.",
      "bad-flag": "That isn't a kind of problem this app reports.",
      "note-required": "Say what went wrong and it can be looked into.",
      "name-required": "A name is needed.",
      "title-required": "A title is needed.",
      "too-large": "That is too big to store.",
      "bad-image": "That picture couldn't be stored. Use a PNG, JPEG, WebP or GIF.",
      "not-in-course": "You aren't in that course.",
      "no-access": "You don't have access to that.",
      "not-yourself": "Use the danger zone in Settings to close your own account.",
      "use-delete-account": "Delete your own account from Settings instead.",
      "not-found": "That no longer exists.",
      "signup-code-required": "This site needs an invitation code to make an account.",
      "storage-unconfigured":
        "The server can't reach its storage. Check that DATA_DIR points at " +
        "a writable directory.",
      server: "The server hit an error. Check the site's function log.",
      "bad-response": "The server's answer wasn't in a form this app understands.",
    }[m] || `Something went wrong (${m}). Try again in a moment.`
  );
}
