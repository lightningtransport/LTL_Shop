'use client';

import { useEffect, useRef, useState } from 'react';
import { MousePointerClick } from 'lucide-react';
import { useDemoMode } from '@/lib/demo/demo-context';
import { cursorPoint, demoCursor } from '@/lib/demo/cursor';
import { findSpotlightTarget, isClickable, spotlightPhase } from '@/lib/demo/spotlight';
import { Button } from './ui';

/**
 * D39 (DP2): lights up what the current step asks to tap, with a bubble that says it, so someone who has never seen
 * the app knows where to press. Purely visual: the dimmed page stays clickable. Tapping the lit element (or "Got it")
 * puts the light out for that step; steps whose tap is the whole step move on by themselves.
 * D40: the demo cursor rests on the lit element (DA2); tapping the step's last lit button moves the step on by
 * itself, once its form has closed (DA1). While Play runs, Play moves the cursor and the steps.
 */
/** Time to see what the tap did before the next step opens. */
const ADVANCE_AFTER_MS = 1_400;
/** A form that saves closes; one still open after this did not save (a field is missing). */
const FORM_CLOSE_WAIT_MS = 10_000;
const PAD = 6;
const POLL_MS = 250;
const GIVE_UP_MS = 10_000;
const SETTLE_MS = 2_000;
/** A form takes a moment to open after its button is tapped. */
const REOPEN_GRACE_MS = 1_500;
const BUBBLE_WIDTH = 300;
/** Height the bubble needs next to the light. */
const BUBBLE_ROOM = 130;

type Box = { top: number; left: number; width: number; height: number; inDialog: boolean };

export function DemoSpotlight() {
  const demo = useDemoMode();
  const key = demo?.story && demo.step ? `${demo.story.id}:${demo.stepIndex}` : null;
  // Steps of two taps light one, then the other; a new step starts over.
  const [phase, setPhase] = useState<{ key: string | null; index: number }>({ key: null, index: 0 });
  const phaseIndex = phase.key === key ? phase.index : 0;
  const first = demo?.step?.spotlight;
  const spotlight = spotlightPhase(first, phaseIndex);
  const active = !!demo?.available && !!demo.state.started && !!spotlight && demo.onStepScreen !== false && !demo.busy;
  const [box, setBox] = useState<Box | null>(null);
  const goToStep = demo?.goToStep;
  const markDone = demo?.markSpotlightDone;
  const stepIndex = demo?.stepIndex ?? 0;
  const lit = active && !demo?.spotlightDone;
  const playing = !!demo?.state.playing;
  const lookOnly = !!demo?.step?.look;
  const stepIsCurrent = useRef<string | null>(null);
  stepIsCurrent.current = key;

  useEffect(() => {
    if (!lit || !spotlight || !key) {
      setBox(null);
      return;
    }
    let element: HTMLElement | null = null;
    let foundAt: number | null = null;
    const started = Date.now();
    const measure = () => {
      if (!element || !element.isConnected) element = findSpotlightTarget(spotlight);
      // A dialog opened over the page (the step's own form): the light would dim it.
      const dialog = document.querySelector('[role="dialog"], [role="alertdialog"]');
      if (!element || (dialog && !dialog.contains(element))) {
        setBox(null);
        return;
      }
      // Bring it into view; for a moment after it shows up, again if the page's own scroll (a new screen) moves it out.
      foundAt ??= Date.now();
      const first = element.getBoundingClientRect();
      // On a phone the panel is a bottom bar: what it covers counts as out of view, and the target goes to the top.
      const panelTop = document.getElementById('demo-panel')?.getBoundingClientRect().top ?? window.innerHeight;
      const bottomBar = panelTop > window.innerHeight / 2;
      const visibleBottom = bottomBar ? panelTop : window.innerHeight;
      if ((first.bottom < 0 || first.top > visibleBottom - 40) && Date.now() - foundAt < SETTLE_MS) {
        if (bottomBar) element.style.scrollMarginTop = '96px';
        element.scrollIntoView({ block: bottomBar ? 'start' : 'center', inline: 'nearest' });
      }
      // Measured after the scroll (which may have run a nested measure already).
      const rect = element.getBoundingClientRect();
      if (!playing) {
        const point = cursorPoint(rect);
        const now = demoCursor.get();
        if (!now.visible || Math.abs(now.x - point.x) > 2 || Math.abs(now.y - point.y) > 2) demoCursor.moveTo(point.x, point.y, now.visible ? 500 : 700);
      }
      setBox((previous) => {
        const next = { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, inDialog: !!dialog };
        return previous && previous.top === next.top && previous.left === next.left && previous.width === next.width && previous.height === next.height && previous.inDialog === next.inDialog ? previous : next;
      });
    };
    const timer = window.setInterval(() => {
      // The form of a two-tap step was closed without finishing: light the first tap again.
      if (!element && phaseIndex > 0 && first && Date.now() - started > REOPEN_GRACE_MS && !document.querySelector('[role="dialog"], [role="alertdialog"]') && findSpotlightTarget(first)) {
        setPhase({ key, index: 0 });
        return;
      }
      if (!element && Date.now() - started > GIVE_UP_MS) {
        // The second tap of a step never showed up (the screen went another way): point at Next instead.
        if (phaseIndex > 0) markDone?.();
        return;
      }
      measure();
    }, POLL_MS);
    measure();
    const onClick = (event: MouseEvent) => {
      // A quick tap can land before the next poll found the element (a form that just opened): look now.
      if (!element || !element.isConnected) element = findSpotlightTarget(spotlight);
      if (!element || !(event.target instanceof Node) || !element.contains(event.target)) return;
      if (spotlight.then) {
        setPhase({ key, index: phaseIndex + 1 });
        return;
      }
      const tapped = element;
      markDone?.();
      // Play moves the steps itself; a step only to look at waits for Next.
      if (playing || !goToStep || (lookOnly && !spotlight.advanceOnClick) || !isClickable(tapped)) return;
      // Scheduled outside the effect: the light going out unmounts this listener, the tap still moves the step on.
      // A tap inside a form moves on once the form closes (it saved); still open means a field is missing.
      const form = tapped.closest('[role="dialog"], [role="alertdialog"]');
      const tappedAt = Date.now();
      const moveOn = () => {
        if (stepIsCurrent.current !== key) return;
        if (form?.isConnected) {
          if (Date.now() - tappedAt < FORM_CLOSE_WAIT_MS) setTimeout(moveOn, 250);
          return;
        }
        void goToStep(stepIndex + 1);
      };
      setTimeout(moveOn, ADVANCE_AFTER_MS);
    };
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    document.addEventListener('click', onClick, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      document.removeEventListener('click', onClick, true);
    };
  }, [lit, spotlight, first, key, phaseIndex, goToStep, markDone, stepIndex, playing, lookOnly]);

  // Manual: the cursor shows only while something is lit. Play moves (and hides) it itself.
  useEffect(() => {
    if (!playing && !lit) demoCursor.hide();
  }, [playing, lit]);

  if (!lit || !box || !spotlight) return null;

  // On a wide screen the panel is a column on the right: a bubble for the page stays out from under it. Above
  // dialogs (z-[60]): the step's own form may be the target.
  const panel = document.getElementById('demo-panel')?.getBoundingClientRect();
  const viewportWidth = panel && panel.left > window.innerWidth / 2 && box.left + box.width <= panel.left ? panel.left - 8 : window.innerWidth;
  const viewportHeight = window.innerHeight;
  // On a phone the panel is a bottom bar: the bubble never covers its buttons.
  const bottomBar = panel && panel.top > viewportHeight / 2 ? panel.top : null;
  const roomBottom = bottomBar ?? viewportHeight;
  const below = box.top + box.height + BUBBLE_ROOM < roomBottom;
  const above = box.top > BUBBLE_ROOM;
  const bubbleLeft = Math.min(Math.max(8, box.left), Math.max(8, viewportWidth - BUBBLE_WIDTH - 8));
  const width = Math.min(BUBBLE_WIDTH, viewportWidth - 16);
  const bubbleStyle = below
    ? { top: box.top + box.height + 10, left: bubbleLeft, width }
    : above
      ? { bottom: Math.max(viewportHeight - box.top + 10, viewportHeight - roomBottom + 8), left: bubbleLeft, width }
      : { bottom: viewportHeight - roomBottom + 8, left: bubbleLeft, width };

  return (
    <>
      <div
        data-demo-spotlight="ring"
        aria-hidden="true"
        className={`pointer-events-none fixed rounded-lg ring-2 ring-primary ${box.inDialog ? 'z-[60]' : 'z-[45]'}`}
        // Inside a form dialog only the ring, above the dialog: the fields around it must stay readable. On the page the
        // dim stays under the panel (z-50), so its Next is never darkened.
        style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: box.inDialog ? undefined : '0 0 0 9999px rgb(0 0 0 / 0.4)' }}
      />
      <div
        data-demo-spotlight="bubble"
        role="status"
        aria-live="polite"
        className="fixed z-[60] rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-xl"
        style={bubbleStyle}
      >
        <p className="flex items-start gap-2">
          <MousePointerClick aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{spotlight.hint}</span>
        </p>
        {playing ? null : (
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => markDone?.()}>Got it</Button>
          </div>
        )}
      </div>
    </>
  );
}
