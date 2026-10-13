/**
 * D39 (DP2): which element a demo step points at. A step names it by its visible text (English: the demo runs in
 * English) or by a selector, so the product screens need no demo-only markup. The panel itself is never a target.
 */
export type DemoLocator = {
  /** Visible text of the element, as on screen (case-insensitive, start of the text unless `contains`). */
  text?: string;
  contains?: boolean;
  /** CSS selector instead of (or to narrow) the text search. */
  selector?: string;
  /** D40: a form field by the text of its label (the input, select or textarea it names). */
  label?: string;
  /** D40: search only inside this element (a table row, a card). */
  in?: DemoLocator;
  /** D40: search only inside the open dialog (the step's form). */
  inDialog?: boolean;
};

export type DemoSpotlight = DemoLocator & {
  /** Short line in the bubble: what to tap or where to look. */
  hint: string;
  /** Tapping the element is the step: the panel moves on by itself shortly after. */
  advanceOnClick?: boolean;
  /** What to light up after this one is tapped (Resolve → Confirm resolve). */
  then?: DemoSpotlight;
};

/** The light at `phase` taps into the step (0 = the first one), or null past the end. */
export function spotlightPhase(spotlight: DemoSpotlight | undefined, phase: number): DemoSpotlight | null {
  let current: DemoSpotlight | undefined = spotlight;
  for (let index = 0; current && index < phase; index += 1) current = current.then;
  return current ?? null;
}

const CLICKABLE = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="link"], summary, select, label';
/** D40: tapping it does something (a button, a link, a tab), as opposed to a heading or a card to look at. */
export function isClickable(element: Element): boolean {
  return element.matches(CLICKABLE) || !!element.closest('button, a[href], [role="button"], [role="tab"], [role="menuitem"]');
}

const READABLE = 'h1, h2, h3, h4, [data-testid], li, tr, article, section, p';

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function visible(element: Element): boolean {
  const html = element as HTMLElement;
  if (html.closest('#demo-panel, [data-demo-spotlight]')) return false;
  // D40: behind an open dialog (the page is aria-hidden or inert under it) nobody can tap it.
  if (html.closest('[aria-hidden="true"], [inert]')) return false;
  const rect = html.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(html);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

function matches(element: Element, text: string, contains: boolean): boolean {
  const label = normalize(element.getAttribute('aria-label'));
  const content = normalize(element.textContent);
  const wanted = normalize(text);
  if (contains) return content.includes(wanted) || label.includes(wanted);
  return content.startsWith(wanted) || label.startsWith(wanted);
}

const FIELDS = 'input:not([type="hidden"]), select, textarea';

/** The control a label names: `for`, a field inside it, or the field right after it. */
function fieldOf(label: Element): HTMLElement | null {
  const control = (label as HTMLLabelElement).control;
  if (control) return control;
  const inside = label.querySelector(FIELDS);
  if (inside) return inside as HTMLElement;
  const next = label.nextElementSibling;
  if (next?.matches(FIELDS)) return next as HTMLElement;
  return (next?.querySelector(FIELDS) as HTMLElement | null) ?? null;
}

function openDialog(root: ParentNode): ParentNode | null {
  const dialogs = [...root.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter((dialog) => !dialog.closest('#demo-panel'));
  return dialogs[dialogs.length - 1] ?? null;
}

/** The element to light up, or null while the screen has not rendered it (data still loading, wrong screen). */
export function findSpotlightTarget(spotlight: DemoLocator, root: ParentNode = document): HTMLElement | null {
  if (spotlight.inDialog) {
    const dialog = openDialog(root);
    if (!dialog) return null;
    return findSpotlightTarget({ ...spotlight, inDialog: false }, dialog);
  }
  if (spotlight.in) {
    const scope = findSpotlightTarget(spotlight.in, root);
    if (!scope) return null;
    return findSpotlightTarget({ ...spotlight, in: undefined }, scope);
  }
  if (spotlight.label) {
    const wanted = normalize(spotlight.label);
    for (const label of root.querySelectorAll('label')) {
      if (!normalize(label.textContent).startsWith(wanted)) continue;
      const field = fieldOf(label);
      if (field && (visible(field) || field.matches('input[type="checkbox"], input[type="radio"]'))) return field;
    }
    const named = [...root.querySelectorAll(FIELDS)].find((field) => visible(field) && normalize(field.getAttribute('aria-label') ?? field.getAttribute('placeholder')).startsWith(wanted));
    return (named as HTMLElement | undefined) ?? null;
  }
  if (!spotlight.text) {
    const hit = spotlight.selector ? [...root.querySelectorAll(spotlight.selector)].find(visible) : undefined;
    return (hit as HTMLElement | undefined) ?? null;
  }
  const pools = spotlight.selector ? [spotlight.selector] : [CLICKABLE, READABLE];
  for (const pool of pools) {
    const candidates = [...root.querySelectorAll(pool)].filter((element) => visible(element) && matches(element, spotlight.text!, !!spotlight.contains));
    if (!candidates.length) continue;
    // The innermost match: "Truck 973" lights the row, not the whole table that also contains it.
    const innermost = candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));
    return (innermost[0] ?? candidates[0]) as HTMLElement;
  }
  return null;
}
