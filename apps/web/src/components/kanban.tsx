'use client';

import { useCallback, useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import { ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui';

/*
 * D33: a Kanban board laid out like Trello. Lists of a fixed width (18 rem) side by side, the title on top (an empty
 * list too); a list is as tall as its cards and, once it reaches the bottom of the board, scrolls its cards inside;
 * the board scrolls sideways inside itself. Phones keep a foldable list per column, empty ones hidden (no sideways
 * scroll on phones, design-system rule).
 */

export function KanbanBoard({ children, label, labelId, className, ...rest }: {
  children: ReactNode;
  /** Visually hidden heading of the board. */
  label: string;
  labelId: string;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, 'children'>) {
  return (
    <section
      aria-labelledby={labelId}
      className={cn(
        'space-y-4',
        'lg:flex lg:items-start lg:gap-3 lg:space-y-0 lg:overflow-x-auto lg:overflow-y-hidden lg:overscroll-x-contain lg:pb-3',
        className,
      )}
      {...rest}
    >
      <h2 id={labelId} className="sr-only">{label}</h2>
      {children}
    </section>
  );
}

export function KanbanColumn({ id, index, title, count, emptyLabel, open = true, onToggle, children, ...props }: {
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
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'id' | 'title'>) {
  const headingId = `kanban-column-${id}`;
  const empty = count === 0;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'lg:flex lg:max-h-full lg:w-72 lg:shrink-0 lg:flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:bg-muted/30',
        empty && 'hidden',
      )}
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
      <div className={cn('mt-1 flex-col gap-2 lg:mt-0 lg:flex lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-contain lg:p-2', open ? 'flex' : 'hidden')}>
        {empty ? <p className="px-1 pb-1 text-xs text-muted-foreground">{emptyLabel}</p> : children}
      </div>
    </section>
  );
}

/**
 * Full screen for a board (GitHub Projects / Jira "full screen"). The browser goes full screen on the whole page and
 * the board covers it as a fixed layer, so dialogs (portaled to <body>) still open above it. Where the browser has
 * no Fullscreen API (iPhone Safari) the layer alone covers the window. Esc leaves.
 */
export function useKanbanFullscreen() {
  const [active, setActive] = useState(false);

  const exit = useCallback(() => {
    setActive(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, []);

  const enter = useCallback(() => {
    setActive(true);
    const root = document.documentElement;
    if (document.fullscreenEnabled && !document.fullscreenElement) void root.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    // The browser's own Esc leaves its full screen; follow it.
    function onChange() {
      if (!document.fullscreenElement) setActive(false);
    }
    function onKey(event: KeyboardEvent) {
      // Browsers usually keep Esc for leaving their own full screen; when it reaches the page, leave too. An open
      // dialog keeps Esc for itself.
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('[role="dialog"]')) exit();
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('keydown', onKey);
    };
  }, [active, exit]);

  useEffect(() => exit, [exit]);

  return { active, enter, exit, toggle: active ? exit : enter };
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
    <Button type="button" variant="outline" size="sm" className={className} aria-pressed={active} onClick={onClick} data-testid="kanban-fullscreen">
      <Icon aria-hidden="true" />{active ? exitLabel : enterLabel}
    </Button>
  );
}
