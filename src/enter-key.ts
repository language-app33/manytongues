/*
 * Enter presses the screen's main button, on a computer (0.653).
 *
 * Every screen with one main action draws it as the one primary button,
 * and on a computer Enter now presses it, wherever the cursor is — so a
 * name can be typed and sent, a session started, an answer checked and the
 * next question reached, without the mouse. One rule here rather than a key
 * handler beside each of a hundred buttons, so a screen added later gets
 * it without anybody remembering to.
 *
 * What it will not do, and why:
 *
 * - **Guess.** If the uppermost layer — the open sheet or dialog, else the
 *   screen — shows no primary button, or more than one, Enter does nothing.
 *   Two primaries means two actions of equal weight, and picking one by
 *   position is how the wrong thing gets done.
 * - **Press a red button.** A delete or remove is drawn `danger`, never
 *   primary, so Enter can never confirm one.
 * - **Press a toggle.** A button that shows a state (`aria-pressed`) is
 *   drawn primary while it is on; pressing it again would switch it off.
 * - **Act on a phone or tablet.** A phone keyboard's Go is the same key,
 *   and the answer box gave it up (it marked half-typed answers when a
 *   thumb reaching for the bottom row caught it). The test is the pointer:
 *   a mouse or trackpad that can hover is a computer.
 * - **Take Enter from something that already uses it.** A focused button
 *   or link presses itself; a text area writes a new line; a list box
 *   opens; a field inside a real form submits that form; a search box
 *   only searches; and a field with its own Enter (naming a tag, typing a
 *   rename) says so by cancelling the key, which is read here as "taken".
 * - **Repeat.** A held key or a press with Shift, Ctrl, Alt or Cmd is left
 *   alone, so holding Enter cannot check an answer and race through the
 *   next three questions.
 */

/** The layer a press belongs to: the uppermost open dialog, else the page. */
export function topLayer(doc: Document): ParentNode {
  const open = Array.from(doc.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter(shown);
  /* Document order: a dialog opened from inside another is inside it, or
     after it, and either way comes later. */
  return open.length ? open[open.length - 1] : doc;
}

function shown(el: HTMLElement): boolean {
  if (typeof el.checkVisibility === "function") {
    return el.checkVisibility({ visibilityProperty: true, opacityProperty: false } as CheckVisibilityOptions);
  }
  return el.getClientRects().length > 0;
}

/** The one button Enter would press in this layer, or null. */
export function primaryIn(layer: ParentNode): HTMLButtonElement | HTMLElement | null {
  const found = Array.from(layer.querySelectorAll<HTMLElement>(".at-btn.primary")).filter(
    (b) =>
      shown(b) &&
      !b.hasAttribute("aria-pressed") &&
      !b.closest("[inert]") &&
      /* A dialog inside the page, but not open, is not this layer's. */
      (layer === b.ownerDocument || !b.closest('[aria-modal="true"]') || b.closest('[aria-modal="true"]') === layer),
  );
  return found.length === 1 ? found[0] : null;
}

/** Whether the element with focus keeps Enter for itself. */
export function keepsEnter(target: EventTarget | null): boolean {
  /* Not `instanceof Element`: the page's own Element, not this module's. */
  if (!target || (target as Node).nodeType !== 1) return false;
  const el = target as HTMLElement;
  if (el.isContentEditable || el.closest('[contenteditable]:not([contenteditable="false"])')) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "A") return true;
  if (tag === "INPUT") {
    const input = el as HTMLInputElement;
    if (input.form) return true; // the form submits itself
    const type = input.type;
    if (type === "search" || type === "button" || type === "submit" || type === "reset" || type === "file") return true;
  }
  const role = el.getAttribute("role");
  if (role && /^(button|link|menuitem|option|tab|checkbox|radio|switch|combobox|listbox|textbox|slider)$/.test(role)) {
    return true;
  }
  return false;
}

/** Whether the press should go to the screen's main button at all. */
export function wantsPrimary(e: KeyboardEvent): boolean {
  return (
    e.key === "Enter" &&
    !e.defaultPrevented &&
    !e.repeat &&
    !e.isComposing &&
    !e.shiftKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey &&
    !keepsEnter(e.target)
  );
}

/** A mouse or trackpad that can hover: a computer, not a phone or tablet. */
function onAComputer(win: Window): boolean {
  try {
    return win.matchMedia("(hover: hover) and (pointer: fine)").matches;
  } catch {
    return false;
  }
}

/**
 * Listens once, for the life of the page. Bubbling, so every field and
 * button has seen the key first and can have kept it.
 */
export function pressPrimaryOnEnter(win: Window = window, computer: () => boolean = () => onAComputer(win)): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (!wantsPrimary(e) || !computer()) return;
    const button = primaryIn(topLayer(win.document));
    if (!button) return;
    /* A dead button stays dead; one drawn `off` takes the press, because
       that is how it says why nothing happened. */
    if ((button as HTMLButtonElement).disabled) return;
    e.preventDefault();
    button.click();
  };
  win.document.addEventListener("keydown", onKey);
  return () => win.document.removeEventListener("keydown", onKey);
}
