'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Dialog as DialogPrimitive, Popover } from 'radix-ui';
import { Check, Search, UserX } from 'lucide-react';
import type { AdminMessages } from '@/lib/admin-messages';
import { filterPickerMechanics, type PickerMechanic } from '@/lib/mechanic-search';
import { useIsPhone } from '@/lib/use-is-phone';
import { MechanicAvatar } from './mechanic-avatar';

export type { PickerMechanic } from '@/lib/mechanic-search';

const OPTION = 'flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm hover:bg-accent focus-visible:bg-accent [@media(pointer:fine)]:min-h-9';

/**
 * Stage 2 / Stage 8 (mockups): the mechanic picker — a search field, a caption ("{Job} · Standard mechanics"),
 * the mechanics with their avatar color, and "Unassign" last. Next to its button on desktop; a bottom sheet on
 * phones.
 */
export function MechanicPicker({
  trigger,
  title,
  mechanics,
  loading = false,
  currentId,
  messages,
  open,
  onOpenChange,
  onPick,
  onUnassign,
}: {
  trigger: ReactNode;
  title: string;
  mechanics: PickerMechanic[];
  loading?: boolean;
  currentId?: string | null;
  messages: AdminMessages;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (mechanic: PickerMechanic) => void;
  /** Stage 5: "Unassign" while the Job has an owner (Work Order only). */
  onUnassign?: () => void;
}) {
  const phone = useIsPhone();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterPickerMechanics(mechanics, query), [mechanics, query]);
  const change = (next: boolean) => { if (!next) setQuery(''); onOpenChange(next); };

  const body = (
    <div data-testid="mechanic-picker">
      {/* UX-2-001 / UX-2-013: field border, and a visible ring around the label (the input drops its outline). */}
      <label className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring">
        <Search aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="sr-only">{messages.mechanicSearchLabel}</span>
        <input
          autoFocus
          value={query}
          placeholder={messages.mechanicSearchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
          className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:outline-none"
        />
      </label>
      <p className="truncate px-2.5 pb-1 pt-2 text-xs text-muted-foreground">{title}</p>
      <div role="listbox" aria-label={title} className="max-h-64 overflow-auto">
        {loading ? <p className="px-2.5 py-3 text-sm text-muted-foreground">{messages.mechanicPickerLoading}</p> : null}
        {!loading && shown.map((mechanic) => (
          <button
            key={mechanic.id}
            type="button"
            role="option"
            aria-selected={mechanic.id === currentId}
            className={OPTION}
            onClick={() => { setQuery(''); onPick(mechanic); }}
          >
            <MechanicAvatar id={mechanic.id} name={mechanic.name} size="sm" />
            <span className="min-w-0 flex-1 truncate">{mechanic.name}</span>
            {mechanic.id === currentId ? <Check aria-hidden="true" className="size-4 text-primary" /> : null}
          </button>
        ))}
        {!loading && !shown.length ? <p className="px-2.5 py-3 text-sm text-muted-foreground">{messages.mechanicNoMatches}</p> : null}
      </div>
      {!loading && onUnassign && currentId ? (
        <>
          <div role="separator" className="my-1 h-px bg-border" />
          <button type="button" role="option" aria-selected={false} className={`${OPTION} text-muted-foreground`} onClick={() => { setQuery(''); onUnassign(); }}>
            <UserX aria-hidden="true" className="size-4 opacity-80" />
            {messages.unassignJobAction}
          </button>
        </>
      ) : null}
    </div>
  );

  if (phone) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={change}>
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            data-sheet=""
            className="anim-sheet-in fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t bg-card p-2 pb-[calc(0.5rem+var(--app-safe-bottom))] text-card-foreground shadow-2xl focus:outline-none"
          >
            <div aria-hidden="true" className="mx-auto mb-2 mt-1 h-1 w-10 rounded-full bg-muted-foreground/40" />
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            {body}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={change}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="anim-pop-in z-50 w-[min(18rem,calc(100vw-1rem))] rounded-lg border bg-card p-1 text-card-foreground shadow-xl"
        >
          {body}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
