'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Popover } from 'radix-ui';
import { Check, Search } from 'lucide-react';
import type { AdminMessages } from '@/lib/admin-messages';
import { profileInitials } from '@/lib/profile-initials';
import { filterPickerMechanics, type PickerMechanic } from '@/lib/mechanic-search';

export type { PickerMechanic } from '@/lib/mechanic-search';

/**
 * Stage 2: the mechanic picker opened from a button (Next step "Assign" on the Dashboard and the Work
 * Order): a search field and the mechanics who can take the Job, next to the button that opened it.
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
}) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterPickerMechanics(mechanics, query), [mechanics, query]);
  return (
    <Popover.Root open={open} onOpenChange={(next) => { if (!next) setQuery(''); onOpenChange(next); }}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 w-[min(18rem,calc(100vw-1rem))] rounded-xl border bg-popover p-1 text-popover-foreground shadow-soft"
          data-testid="mechanic-picker"
        >
          <label className="flex items-center gap-2 rounded-lg border bg-background px-3 focus-within:border-ring">
            <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">{messages.mechanicSearchLabel}</span>
            <input
              autoFocus
              value={query}
              placeholder={messages.mechanicSearchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
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
                className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-accent focus-visible:bg-accent"
                onClick={() => { setQuery(''); onPick(mechanic); }}
              >
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{profileInitials(mechanic.name)}</span>
                <span className="min-w-0 flex-1 truncate">{mechanic.name}</span>
                {mechanic.id === currentId ? <Check aria-hidden="true" className="size-4 text-primary" /> : null}
              </button>
            ))}
            {!loading && !shown.length ? <p className="px-2.5 py-3 text-sm text-muted-foreground">{messages.mechanicNoMatches}</p> : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
