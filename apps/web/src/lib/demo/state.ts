/**
 * D36: what the local demo panel remembers between screens and reloads. It lives in localStorage on the
 * presenter's laptop; reading and writing never throw (private mode, blocked storage).
 */
export const DEMO_STATE_KEY = 'ltl_shop_demo';

export type DemoState = {
  version: 1;
  /** The presenter turned demo mode on from /login. Off: no Demo button anywhere. */
  enabled: boolean;
  /** Story being walked through (USER_FLOWS id such as "HU-M4"); null when none. */
  storyId: string | null;
  stepIndex: number;
  panelOpen: boolean;
  /** Each step switches user and screen by itself; off, the presenter navigates by hand. */
  autoFollow: boolean;
  /** The chosen story was started (its first screen opened); before that the card only previews step 1. */
  started: boolean;
  /** Just entered from /login: the panel greets once, then clears this. */
  welcome: boolean;
};

export const DEFAULT_DEMO_STATE: DemoState = {
  version: 1,
  enabled: false,
  storyId: null,
  stepIndex: 0,
  panelOpen: false,
  autoFollow: true,
  started: false,
  welcome: false,
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readDemoState(storage: StorageLike | null = browserStorage()): DemoState {
  try {
    const raw = storage?.getItem(DEMO_STATE_KEY);
    if (!raw) return DEFAULT_DEMO_STATE;
    const parsed = JSON.parse(raw) as Partial<DemoState> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return DEFAULT_DEMO_STATE;
    return {
      version: 1,
      enabled: parsed.enabled === true,
      storyId: typeof parsed.storyId === 'string' ? parsed.storyId : null,
      stepIndex: Number.isInteger(parsed.stepIndex) && (parsed.stepIndex as number) >= 0 ? (parsed.stepIndex as number) : 0,
      panelOpen: parsed.panelOpen === true,
      autoFollow: parsed.autoFollow !== false,
      started: parsed.started === true,
      welcome: parsed.welcome === true,
    };
  } catch {
    return DEFAULT_DEMO_STATE;
  }
}

/** Fired on `window` after every write, so the provider (mounted before /login writes) picks the change up. */
export const DEMO_STATE_EVENT = 'ltl-demo-state';

export function writeDemoState(state: DemoState, storage: StorageLike | null = browserStorage()): void {
  try {
    if (state.enabled) storage?.setItem(DEMO_STATE_KEY, JSON.stringify(state));
    else storage?.removeItem(DEMO_STATE_KEY);
  } catch {
    // Storage unavailable: the panel keeps its state in memory for this page only.
  }
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(DEMO_STATE_EVENT));
  } catch {
    // Not in a browser.
  }
}

/** The panel and the header button exist only in a demo-capable build with the mode turned on. */
export function demoPanelAvailable(demoModeAvailable: boolean, state: Pick<DemoState, 'enabled'>): boolean {
  return demoModeAvailable && state.enabled;
}
