'use client';

import { useEffect, useRef } from 'react';
import { DemoPlayError, playActions, playStep, readTimeMs } from '@/lib/demo/autoplay';
import { demoCursor } from '@/lib/demo/cursor';
import { useDemoMode } from '@/lib/demo/demo-context';

/**
 * D40 (DA3): Play. On the step's screen it does the step (the cursor taps, types, picks), waits the time it takes
 * to read the step's "Why", and moves on; an account switch reloads the page and Play goes on from the saved
 * state. A step runs once per page: a screen that changes under it (the step's own tap navigates) does not
 * restart it. Pause stops it where it is.
 */
export function DemoAutoplay() {
  const demo = useDemoMode();
  const playing = !!demo?.available && !!demo.state.playing && !!demo.state.started;
  const key = demo?.story && demo.step ? `${demo.story.id}:${demo.stepIndex}` : null;
  const ranKey = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef(demo);
  latest.current = demo;

  // Pause, another step (Back, Next, the chapter list) or leaving: stop what runs.
  useEffect(() => {
    if (playing) return;
    controller.current?.abort();
    controller.current = null;
    ranKey.current = null;
    demoCursor.hide();
  }, [playing]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (controller.current && ranKey.current !== key) {
      controller.current.abort();
      controller.current = null;
    }
  }, [key]);

  const ready = playing && !!key && demo?.onStepScreen === true && !demo.busy;
  useEffect(() => {
    if (!ready || !key || ranKey.current === key) return;
    const current = latest.current;
    if (!current?.story || !current.step) return;
    ranKey.current = key;
    const run = new AbortController();
    controller.current = run;
    const { step, story, stepIndex } = current;
    const speed = current.state.speed;
    void (async () => {
      try {
        // A moment on the new screen before the hand moves; it also lets the refresh of a same-screen step land, which
        // would otherwise close a form Play just opened. Not shortened by the speed.
        await new Promise((resolve) => setTimeout(resolve, 1800));
        if (run.signal.aborted) return;
        await playStep(playActions(step), speed, run.signal);
        await new Promise<void>((resolve, reject) => {
          const id = setTimeout(resolve, readTimeMs(step, speed));
          run.signal.addEventListener('abort', () => { clearTimeout(id); reject(run.signal.reason); }, { once: true });
        });
        const now = latest.current;
        if (!now?.state.playing || run.signal.aborted) return;
        if (stepIndex >= story.steps.length - 1) {
          demoCursor.hide();
          now.stopPlaying(null);
          return;
        }
        await now.goToStep(stepIndex + 1);
      } catch (error) {
        if (run.signal.aborted) return;
        latest.current?.stopPlaying(error instanceof DemoPlayError ? error.message : 'Play stopped on this step. Do it by hand, then Next or Play.');
      } finally {
        if (controller.current === run) controller.current = null;
      }
    })();
  }, [ready, key]);

  // A step that cannot open (truck missing, server down) stops Play; the panel says why.
  useEffect(() => {
    if (playing && demo?.error) demo.stopPlaying(null);
  }, [playing, demo]);

  return null;
}
