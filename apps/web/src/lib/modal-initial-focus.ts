/**
 * R10: a dialog moves focus to its first field one frame after it opens. By then the person (or a test)
 * may already be typing in another field of the dialog; moving focus then would send the rest of the
 * typing into the first field. The late focus only happens while focus is still outside the dialog
 * (or on the dialog box itself).
 */
export function shouldTakeInitialFocus(
  content: { contains(node: unknown): boolean } | null,
  active: unknown,
): boolean {
  if (!content || !active) return true;
  if (active === content) return true;
  return !content.contains(active);
}
