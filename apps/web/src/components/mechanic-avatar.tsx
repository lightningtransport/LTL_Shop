'use client';

import { cn } from '@/lib/utils';
import { profileInitials } from '@/lib/profile-initials';
import { MECHANIC_TONE_CLASS, mechanicTone } from '@/lib/mechanic-tone';

/** Stage 8 (F5, mockups): a mechanic's initials in their own color. Decorative; the name is always next to it or in a label. */
export function MechanicAvatar({ id, name, size = 'md', className }: { id: string; name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClass = size === 'lg' ? 'size-8' : size === 'sm' ? 'size-6' : 'size-7';
  // UX-4-008 / UX-2-011: at most 3 characters; role codes like "MPM", "MG1", "QC2" get a smaller letter so they
  // fit the circle (12 px needs ~29 px). Decorative (aria-hidden, name beside it), so the 12 px floor yields here.
  const initials = profileInitials(name).slice(0, 3);
  const textClass = initials.length < 3 ? 'text-xs' : size === 'lg' ? 'text-[11px] tracking-tight' : size === 'sm' ? 'text-[9px] tracking-tight' : 'text-[10px] tracking-tight';
  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn('grid shrink-0 place-items-center rounded-full font-semibold leading-none', textClass, sizeClass, MECHANIC_TONE_CLASS[mechanicTone(id)], className)}
    >
      {initials}
    </span>
  );
}

/** Overlapping avatars, up to `max`, then "+N". */
export function MechanicAvatarStack({ mechanics, max = 3, className }: { mechanics: Array<{ id: string; name: string }>; max?: number; className?: string }) {
  if (!mechanics.length) return null;
  const shown = mechanics.slice(0, max);
  const extra = mechanics.length - shown.length;
  return (
    <span className={cn('flex -space-x-1', className)} title={mechanics.map((mechanic) => mechanic.name).join(', ')}>
      {shown.map((mechanic) => <MechanicAvatar key={mechanic.id} id={mechanic.id} name={mechanic.name} className="ring-2 ring-card" />)}
      {extra > 0 ? <span aria-hidden="true" className="tnum grid size-7 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-card">+{extra}</span> : null}
      <span className="sr-only">{mechanics.map((mechanic) => mechanic.name).join(', ')}</span>
    </span>
  );
}
