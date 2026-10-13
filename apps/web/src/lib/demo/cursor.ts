/**
 * D40 (DA2): where the demo cursor is and what it is doing. The spotlight (manual) and Play move it; the cursor
 * component only draws it. A plain store outside React: Play runs outside render, step after step.
 */
export type DemoCursorState = {
  /** Viewport point of the arrow's tip; null hides the cursor. */
  x: number;
  y: number;
  visible: boolean;
  /** Increments on every tap, so the ripple plays again on the same spot. */
  taps: number;
  /** Glide time of the last move, in ms. */
  glideMs: number;
};

let state: DemoCursorState = { x: 0, y: 0, visible: false, taps: 0, glideMs: 0 };
const listeners = new Set<() => void>();

function set(next: Partial<DemoCursorState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export const demoCursor = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  /** Glide to a point; the first appearance starts near it, so the cursor does not fly in from the corner. */
  moveTo(x: number, y: number, glideMs = 700) {
    if (state.visible) {
      set({ x, y, glideMs });
      return;
    }
    set({ x: x + 60, y: y + 50, visible: true, glideMs: 0 });
    // A tick later, so the browser paints the start before it glides.
    setTimeout(() => set({ x, y, glideMs }), 30);
  },
  tap() {
    set({ taps: state.taps + 1 });
  },
  hide() {
    if (state.visible) set({ visible: false });
  },
};

/** Where the cursor rests on an element: a little inside its left part, where people tap a button. */
export function cursorPoint(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + Math.min(rect.width / 2, 28), y: rect.top + rect.height / 2 };
}
