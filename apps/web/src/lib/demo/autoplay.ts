import { cursorPoint, demoCursor } from './cursor';
import type { DemoStep } from './scripts';
import { type DemoLocator, findSpotlightTarget, isClickable } from './spotlight';

/**
 * D40 (DA3): what Play does on a step. The cursor glides to each element and taps it, types into it or picks
 * from it, the way a person would, so the audience sees the hand move. Steps without `play` tap (or only point
 * at) what their spotlight lights up.
 */
export type DemoAction =
  /** `optional`: skipped when it is not on screen (a form the previous step already opened). */
  | { do: 'tap'; at: DemoLocator; optional?: boolean }
  /** Types into an input or textarea, letter by letter (replaces what it had). `{stamp}` becomes the time of day,
   * for numbers that must not repeat between runs (an invoice number). */
  | { do: 'type'; at: DemoLocator; text: string }
  /** Picks in a select: the first option whose text contains `option`, or the first real option. */
  | { do: 'choose'; at: DemoLocator; option?: string }
  /** Glides to it and rests there: something to look at. */
  | { do: 'point'; at: DemoLocator }
  | { do: 'wait'; ms: number }
  /** Presses a key where the focus is (Escape closes a menu that stayed open). */
  | { do: 'key'; key: 'Escape' | 'Enter' };

export class DemoPlayError extends Error {}

const FIND_TIMEOUT_MS = 12_000;
const OPTIONAL_WAIT_MS = 2_500;
const POLL_MS = 200;

/** Play's actions for a step: its own, or what its spotlight lights up (tapped when tapping is the step). */
export function playActions(step: DemoStep): DemoAction[] {
  if (step.play) return step.play;
  const actions: DemoAction[] = [];
  const tapIt = step.look !== true;
  for (let light = step.spotlight; light; light = light.then) {
    actions.push({ do: tapIt ? 'tap' : 'point', at: light });
  }
  return actions;
}

/** How long Play stays on a step after its actions: the time to read its "Why" aloud, at the chosen speed. */
export function readTimeMs(step: Pick<DemoStep, 'say' | 'do'>, speed: number): number {
  const words = (step.say ?? step.do).split(/\s+/).filter(Boolean).length;
  return Math.round(Math.min(Math.max(1500 + words * 260, 3500), 12_000) / speed);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const id = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      reject(signal.reason);
    }, { once: true });
  });
}

function describe(at: DemoLocator): string {
  return at.label ?? at.text ?? at.selector ?? 'the next element';
}

async function find(at: DemoLocator, signal: AbortSignal, optional = false): Promise<HTMLElement | null> {
  const started = Date.now();
  for (;;) {
    const element = findSpotlightTarget(at);
    if (element) return element;
    if (optional && Date.now() - started > OPTIONAL_WAIT_MS) return null;
    if (Date.now() - started > FIND_TIMEOUT_MS) throw new DemoPlayError(`Play could not find "${describe(at)}" on this screen.`);
    await sleep(POLL_MS, signal);
  }
}

/** Scrolls it into view and glides the cursor onto it. */
async function reach(element: HTMLElement, speed: number, signal: AbortSignal): Promise<void> {
  const before = element.getBoundingClientRect();
  if (before.top < 70 || before.bottom > window.innerHeight - 20) {
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await sleep(450, signal);
  }
  const { x, y } = cursorPoint(element.getBoundingClientRect());
  const glide = Math.round(750 / speed);
  demoCursor.moveTo(x, y, glide);
  await sleep(glide + 120, signal);
}

/** A real tap: pointer and mouse events first (menus open on pointerdown), then the click. */
function tapElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const point = { bubbles: true, cancelable: true, composed: true, button: 0, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
  element.dispatchEvent(new PointerEvent('pointerdown', { ...point, pointerType: 'mouse', isPrimary: true }));
  element.dispatchEvent(new MouseEvent('mousedown', point));
  element.focus?.({ preventScroll: true });
  element.dispatchEvent(new PointerEvent('pointerup', { ...point, pointerType: 'mouse', isPrimary: true }));
  element.dispatchEvent(new MouseEvent('mouseup', point));
  element.click();
}

/** Sets a field the way React sees typing: the native setter, then an input event. */
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(element) as object;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}

async function typeInto(element: HTMLElement, text: string, speed: number, signal: AbortSignal) {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    throw new DemoPlayError(`Play expected a text field at "${element.textContent?.trim().slice(0, 40) ?? ''}".`);
  }
  element.focus({ preventScroll: true });
  const perLetter = Math.max(12, Math.round(45 / speed));
  // A date or a number is set at once; text is typed so it can be seen.
  if (['date', 'datetime-local', 'time', 'number'].includes(element.type) || text.length > 60) {
    setNativeValue(element, text);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    setNativeValue(element, '');
    element.dispatchEvent(new Event('input', { bubbles: true }));
    for (let index = 1; index <= text.length; index += 1) {
      setNativeValue(element, text.slice(0, index));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(perLetter, signal);
    }
  }
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function chooseIn(element: HTMLElement, option: string | undefined) {
  if (!(element instanceof HTMLSelectElement)) throw new DemoPlayError('Play expected a list to choose from.');
  const wanted = option?.toLowerCase();
  const pick = [...element.options].find((item) => !item.disabled && (wanted ? item.text.toLowerCase().includes(wanted) : item.value !== ''));
  if (!pick) throw new DemoPlayError(`Play could not find "${option ?? 'an option'}" in the list.`);
  setNativeValue(element, pick.value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/** `{stamp}` → the time of day (D213045), so an invoice number typed by Play is new on every run. */
export function stamped(text: string, now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return text.replaceAll('{stamp}', `D${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`);
}

function dialogOf(element: Element): Element | null {
  return element.closest('[role="dialog"], [role="alertdialog"]');
}

/** Runs one step's actions. Throws DemoPlayError when the screen is not what the step expects. */
export async function playStep(actions: DemoAction[], speed: number, signal: AbortSignal): Promise<void> {
  for (const [index, action] of actions.entries()) {
    if (action.do === 'wait') {
      await sleep(action.ms / speed, signal);
      continue;
    }
    if (action.do === 'key') {
      const target = document.activeElement ?? document.body;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: action.key, code: action.key, bubbles: true, cancelable: true }));
      await sleep(300 / speed, signal);
      continue;
    }
    const element = await find(action.at, signal, action.do === 'tap' && action.optional);
    if (!element) continue;
    await reach(element, speed, signal);
    if (action.do === 'point') {
      await sleep(900 / speed, signal);
      continue;
    }
    if (action.do === 'type') {
      demoCursor.tap();
      await typeInto(element, stamped(action.text), speed, signal);
      await sleep(250 / speed, signal);
      continue;
    }
    if (action.do === 'choose') {
      demoCursor.tap();
      chooseIn(element, action.option);
      await sleep(500 / speed, signal);
      continue;
    }
    if (!isClickable(element)) {
      await sleep(900 / speed, signal);
      continue;
    }
    demoCursor.tap();
    await sleep(140, signal);
    const dialog = dialogOf(element);
    tapElement(element);
    await sleep(700 / speed, signal);
    // The last tap inside a form saves it: the form closes. Still open after a while means it did not save.
    const last = index === actions.length - 1;
    if (last && dialog) {
      const started = Date.now();
      while (dialog.isConnected && Date.now() - started < 8000) await sleep(POLL_MS, signal);
      if (dialog.isConnected) throw new DemoPlayError('The form did not save: it is still open. Check what it says, then Next or Play.');
    }
  }
}
