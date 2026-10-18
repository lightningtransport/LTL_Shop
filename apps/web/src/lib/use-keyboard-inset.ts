/**
 * LTR-234: how much of the screen the on-screen keyboard covers, in CSS px. iOS draws the keyboard over the page
 * without shrinking it, so `fixed bottom-0` sheets end up under it; the visual viewport is what is left on top.
 * Android Chrome with `interactive-widget=resizes-content` shrinks the page itself, so this stays 0 there.
 * Under 80 px is the browser's own toolbar moving, not a keyboard.
 */
export const KEYBOARD_MIN_PX = 80;

export function keyboardInset(innerHeight: number, viewportHeight: number, viewportOffsetTop: number): number {
  const covered = Math.round(innerHeight - viewportHeight - viewportOffsetTop);
  return covered >= KEYBOARD_MIN_PX ? covered : 0;
}

/** The fields that open a keyboard (not buttons, checkboxes or radios). */
export function opensKeyboard(element: Element | null): element is HTMLElement {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (element instanceof HTMLInputElement) return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'color', 'hidden', 'image'].includes(element.type);
  return element instanceof HTMLElement && element.isContentEditable;
}
