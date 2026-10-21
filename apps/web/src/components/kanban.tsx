'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui';

/*
 * D33: a Kanban board laid out like Trello. Lists of a fixed width (18 rem) side by side, the title on top (an empty
 * list too); a list is as tall as its cards and, once it reaches the bottom of the board, scrolls its cards inside;
 * the board scrolls sideways inside itself. Phones keep a foldable list per column, empty ones hidden (no sideways
 * scroll on phones, design-system rule).
 *
 * LTR-227: with a mouse (no trackpad swipe) the board moves sideways like Trello: a scrollbar always shown at the
 * bottom, and dragging the empty board (not a card, link or button) pans it. Shift + wheel works as in any browser.
 *
 * D53 (LTR-266): `fit` is the board on a TV (the Full screen tab), where nobody can scroll. The lists share the
 * screen width (no 18 rem minimum, no sideways scroll), each one is as tall as the board, and a list whose cards
 * don't fit turns compact (`data-compact` on the list; cards style themselves with `group-data-[compact=true]/lane:`).
 */

/** Pressed on these, a drag is theirs (a click, a text selection), not the board's. */
const KANBAN_NO_PAN = 'a,button,input,select,textarea,label,[role="button"],[role="dialog"],[data-kanban-card]';
/** Pixels a press moves before it counts as a drag (a smaller move stays a click). */
const KANBAN_PAN_THRESHOLD = 4;

function useKanbanPan() {
  const pan = useRef<{ pointerId: number; startX: number; startLeft: number; moved: boolean } | null>(null);
  const [panning, setPanning] = useState(false);

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const board = event.currentTarget;
    // Phones stack the lists (nothing to pan); only a board wider than its box pans.
    if (board.scrollWidth <= board.clientWidth) return;
    if ((event.target as Element).closest(KANBAN_NO_PAN)) return;
    pan.current = { pointerId: event.pointerId, startX: event.clientX, startLeft: board.scrollLeft, moved: false };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const current = pan.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    if (!current.moved) {
      if (Math.abs(dx) < KANBAN_PAN_THRESHOLD) return;
      current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setPanning(true);
    }
    event.preventDefault();
    event.currentTarget.scrollLeft = current.startLeft - dx;
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLElement>) {
    const current = pan.current;
    if (!current || current.pointerId !== event.pointerId) return;
    pan.current = null;
    if (current.moved) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      setPanning(false);
    }
  }

  return {
    panning,
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd },
  };
}

export function KanbanBoard({ children, label, labelId, fit = false, className, ...rest }: {
  children: ReactNode;
  /** Visually hidden heading of the board. */
  label: string;
  labelId: string;
  /** D53: every list fits the screen, nothing scrolls (a TV). */
  fit?: boolean;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, 'children'>) {
  const { panning, handlers } = useKanbanPan();
  return (
    <section
      aria-labelledby={labelId}
      className={cn(
        'space-y-4',
        fit
          ? 'lg:flex lg:items-stretch lg:gap-2 lg:space-y-0 lg:overflow-hidden'
          : cn(
            'lg:flex lg:items-start lg:gap-3 lg:space-y-0 lg:overflow-x-auto lg:overflow-y-hidden lg:overscroll-x-contain lg:pb-3',
            // LTR-227: the sideways scrollbar is always shown (globals.css), so a mouse reaches every list.
            'kanban-scrollbar',
          ),
        panning && 'cursor-grabbing select-none',
        className,
      )}
      data-panning={panning || undefined}
      data-fit={fit || undefined}
      {...(fit ? {} : handlers)}
      {...rest}
    >
      <h2 id={labelId} className="sr-only">{label}</h2>
      {children}
    </section>
  );
}

/**
 * D53: a fitted list turns compact when its cards don't fit its height, and back when the normal cards fit again.
 * It remembers how tall the normal cards were, so the compact cards (shorter) don't flip it straight back.
 */
function useFitCompact(enabled: boolean, count: number) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const compactRef = useRef(false);
  const normalHeight = useRef(0);
  compactRef.current = compact;

  const measure = useCallback(() => {
    const body = bodyRef.current;
    if (!enabled || !body) return;
    if (!compactRef.current) {
      if (body.scrollHeight > body.clientHeight + 1) {
        normalHeight.current = body.scrollHeight;
        setCompact(true);
      }
    } else if (body.clientHeight >= normalHeight.current) {
      setCompact(false);
    }
  }, [enabled]);

  // Cards came or went: measure the normal cards again (before paint, so nothing flashes).
  useLayoutEffect(() => {
    normalHeight.current = 0;
    setCompact(false);
  }, [count, enabled]);
  // A card's text can change its height (the board refreshes every 30 s).
  useLayoutEffect(measure);
  useEffect(() => {
    const body = bodyRef.current;
    if (!enabled || !body) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [enabled, measure]);

  return { bodyRef, compact: enabled && compact };
}

export function KanbanColumn({ id, index, title, count, emptyLabel, open = true, onToggle, fit = false, children, ...props }: {
  id: string;
  /** 1-based position shown before the title. */
  index?: number;
  title: string;
  count: number;
  /** Shown inside an empty list. */
  emptyLabel: string;
  /** Phones only: the column folds. */
  open?: boolean;
  onToggle?: () => void;
  /** D53: shares the board width, as tall as the board, compact cards when full. */
  fit?: boolean;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'id' | 'title'>) {
  const headingId = `kanban-column-${id}`;
  const empty = count === 0;
  const { bodyRef, compact } = useFitCompact(fit, count);

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'group/lane lg:flex lg:flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:bg-muted/30',
        // LTR-259: columns share the board width (never under 18rem); more than fit scroll sideways. D53: on a TV
        // they share it with no minimum.
        fit ? 'lg:min-w-0 lg:flex-[1_1_0%]' : 'lg:max-h-full lg:min-w-72 lg:flex-[1_0_18rem]',
        empty && 'hidden',
      )}
      data-compact={compact || undefined}
      {...props}
    >
      <h3 id={headingId} className="lg:shrink-0 lg:px-3 lg:pb-1 lg:pt-2.5">
        <button
          type="button"
          aria-expanded={open}
          className="flex min-h-11 w-full items-center gap-2 text-left font-semibold lg:pointer-events-none lg:min-h-0 lg:text-sm"
          onClick={onToggle}
        >
          {index !== undefined ? <span aria-hidden="true" className="hidden text-muted-foreground lg:inline">{index}.</span> : null}
          {title}
          <span aria-hidden="true" className="tnum rounded-md bg-muted px-1.5 text-xs font-normal text-muted-foreground ring-1 ring-border lg:ml-auto">{count}</span>
          <ChevronDown aria-hidden="true" className={cn('ml-auto size-3.5 text-muted-foreground transition-transform lg:hidden', open && 'rotate-180')} />
        </button>
      </h3>
      <div ref={bodyRef} className={cn('mt-1 flex-col gap-2 lg:mt-0 lg:flex lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-contain lg:p-2', fit && 'lg:flex-1', compact && 'lg:gap-1.5', open ? 'flex' : 'hidden')}>
        {empty ? <p className="px-1 pb-1 text-xs text-muted-foreground">{emptyLabel}</p> : children}
      </div>
    </section>
  );
}

/**
 * LTR-228: the board alone in its own browser tab (`display=board`) can go full screen for a TV or a second monitor.
 * The browser asks for a click before it goes full screen, so this follows the button; Esc (the browser's) leaves.
 * `supported` is false where the browser has no Fullscreen API (iPhone Safari).
 */
export function useBrowserFullscreen() {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(Boolean(document.fullscreenEnabled));
    function onChange() {
      setActive(Boolean(document.fullscreenElement));
    }
    onChange();
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  return { active, supported, toggle };
}

/** LTR-228: "Full screen" opens the board alone in a new browser tab (a link, so middle click works too). */
export function KanbanOpenBoardLink({ href, label, title, className }: {
  href: string;
  label: string;
  /** Says it opens a new tab. */
  title: string;
  className?: string;
}) {
  return (
    <Button asChild variant="outline" size="sm" className={className}>
      <a href={href} target="_blank" rel="noopener" title={title} data-testid="kanban-fullscreen">
        <Maximize2 aria-hidden="true" />{label}
      </a>
    </Button>
  );
}

export function KanbanFullscreenButton({ active, onClick, enterLabel, exitLabel, className }: {
  active: boolean;
  onClick: () => void;
  enterLabel: string;
  exitLabel: string;
  className?: string;
}) {
  const Icon = active ? Minimize2 : Maximize2;
  return (
    <Button type="button" variant="outline" size="sm" className={className} aria-pressed={active} onClick={onClick} data-testid="kanban-browser-fullscreen">
      <Icon aria-hidden="true" />{active ? exitLabel : enterLabel}
    </Button>
  );
}
