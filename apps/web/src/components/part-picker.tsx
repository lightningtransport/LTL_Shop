'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { AdminPartCategoryDto } from '@ltl-shop/shared';
import { Button, Input } from './ui';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { cn } from '@/lib/utils';

/** The value of a line whose part is only on this invoice (same sentinel as the purchase form). */
export const OTHER_PART = '__other__';

type Choice =
  | { kind: 'part'; id: string; label: string; category: string }
  | { kind: 'use-typed'; text: string }
  | { kind: 'add-typed'; text: string }
  | { kind: 'other' };

const partLabel = (part: { displayName: string; partNumber: string | null }) => `${part.displayName}${part.partNumber ? ` · ${part.partNumber}` : ''}`;
const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * LTR-298: the part of a purchase line is typed, not picked from a long native list. Typing filters Parts by name or
 * number; a part that is not there is used as typed, only on this invoice, or added to Parts from here. Leaving the
 * field with text that matches nothing keeps the text (an "Other" line), so nothing typed is lost.
 */
export function PartPicker({
  id,
  categories,
  value,
  description,
  disabled,
  invalid,
  messages,
  onChange,
  onAddToCatalog,
}: {
  id: string;
  categories: AdminPartCategoryDto[];
  /** A part id, `OTHER_PART`, or '' (nothing picked). */
  value: string;
  /** The text of an "Other" line. */
  description: string;
  disabled?: boolean;
  invalid?: boolean;
  messages: AdminMessages;
  onChange: (partId: string, description: string) => void;
  /** Opens the part dialog with the typed text; the line takes the new part once saved. */
  onAddToCatalog?: (text: string) => void;
}) {
  const listId = useId();
  const parts = useMemo(
    () => categories.flatMap((category) => category.parts.filter((part) => part.active || part.id === value).map((part) => ({ id: part.id, label: partLabel(part), category: category.name, key: fold(partLabel(part)) }))),
    [categories, value],
  );
  const selectedLabel = value === OTHER_PART ? description : value ? parts.find((part) => part.id === value)?.label ?? '' : '';
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pickingRef = useRef(false);

  // What is picked changed from outside (a part added to Parts, the PDF reader): the field says so.
  useEffect(() => {
    setQuery(selectedLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selectedLabel]);

  const typed = query.trim();
  const needle = fold(typed);
  const matches = needle ? parts.filter((part) => part.key.includes(needle)) : parts;
  const exact = typed ? parts.find((part) => part.key === needle) : undefined;
  // LTR-298: the ways out come first and stay in sight, before the (long) list of parts: add a part to Parts (with
  // the typed text, if any), use the text only on this invoice, or an "Other" line to type freely.
  const actions: Choice[] = [
    ...(onAddToCatalog ? [{ kind: 'add-typed', text: typed } as Choice] : []),
    ...(typed && !exact ? [{ kind: 'use-typed', text: typed } as Choice] : []),
    ...(!typed ? [{ kind: 'other' } as Choice] : []),
  ];
  const choices: Choice[] = [
    ...actions,
    ...matches.map((part): Choice => ({ kind: 'part', id: part.id, label: part.label, category: part.category })),
  ];
  // Typing lands on the first part that matches; Enter takes it. With nothing typed, on the first action.
  const activeIndex = Math.min(active ?? (matches.length ? actions.length : 0), Math.max(choices.length - 1, 0));

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function pick(choice: Choice) {
    pickingRef.current = true;
    setOpen(false);
    if (choice.kind === 'part') onChange(choice.id, '');
    else if (choice.kind === 'use-typed') onChange(OTHER_PART, choice.text);
    else if (choice.kind === 'other') {
      onChange(OTHER_PART, '');
      setQuery('');
      inputRef.current?.focus();
    } else {
      onChange(OTHER_PART, choice.text);
      onAddToCatalog?.(choice.text);
    }
    setTimeout(() => { pickingRef.current = false; }, 0);
  }

  /** Leaving with text that is a part takes it; other text stays as an "Other" line; nothing clears the line. */
  function settle() {
    if (pickingRef.current) return;
    setOpen(false);
    if (!typed) {
      if (value) onChange('', '');
      return;
    }
    if (exact) {
      if (exact.id !== value) onChange(exact.id, '');
      return;
    }
    if (value !== OTHER_PART || description !== typed) onChange(OTHER_PART, typed);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return setOpen(true);
      setActive(event.key === 'ArrowDown' ? Math.min(activeIndex + 1, choices.length - 1) : Math.max(activeIndex - 1, 0));
    } else if (event.key === 'Enter') {
      if (!open) return;
      event.preventDefault();
      const choice = choices[activeIndex];
      if (choice) pick(choice);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setQuery(selectedLabel);
    }
  }

  let lastCategory = '';
  return (
    <div className="relative" data-testid="part-picker" data-value={value}>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && choices[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={messages.pcPartSearch}
          value={query}
          disabled={disabled}
          className="pr-16"
          onChange={(event) => { setQuery(event.target.value); setActive(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={settle}
          onKeyDown={onKeyDown}
        />
        <div className="absolute inset-y-0 right-1 flex items-center">
          {query ? (
            <Button type="button" variant="ghost" size="sm" className="size-8 min-h-0 p-0" aria-label={messages.pcPartPickerClear} tabIndex={-1} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(''); onChange('', ''); inputRef.current?.focus(); }}>
              <X aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="size-8 min-h-0 p-0" aria-label={messages.pcPartPickerOpen} tabIndex={-1} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen((current) => !current); inputRef.current?.focus(); }}>
            <ChevronDown aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
      {open ? (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover py-1 text-sm shadow-md"
          onMouseDown={(event) => event.preventDefault()}
        >
          {typed && !matches.length ? <p className="px-3 py-2 text-xs text-muted-foreground">{fillPlaceholders(messages.pcPartNoMatch, { text: typed })}</p> : null}
          {choices.map((choice, index) => {
            const header = choice.kind === 'part' && choice.category !== lastCategory ? choice.category : null;
            if (choice.kind === 'part') lastCategory = choice.category;
            const text = choice.kind === 'part' ? choice.label
              : choice.kind === 'use-typed' ? fillPlaceholders(messages.pcPartUseAsTyped, { text: choice.text })
              : choice.kind === 'add-typed' ? (choice.text ? fillPlaceholders(messages.pcPartAddTyped, { text: choice.text }) : messages.pcPartAddNew)
              : messages.pcLineOther;
            return (
              <div key={choice.kind === 'part' ? choice.id : choice.kind}>
                {header ? <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">{header}</p> : null}
                {choice.kind === 'part' && index > 0 && choices[index - 1].kind !== 'part' ? <div className="my-1 border-t" /> : null}
                <div
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={choice.kind === 'part' ? choice.id === value : false}
                  data-index={index}
                  data-kind={choice.kind}
                  className={cn('cursor-pointer px-3 py-2', index === activeIndex ? 'bg-accent' : 'hover:bg-accent/60', choice.kind !== 'part' ? 'font-medium text-primary' : '')}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(choice)}
                >
                  {text}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
