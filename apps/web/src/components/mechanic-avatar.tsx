'use client';

import { cn } from '@/lib/utils';
import { profileInitials } from '@/lib/profile-initials';
import { MECHANIC_TONE_CLASS, mechanicTone } from '@/lib/mechanic-tone';

/** Stage 8 (F5, mockups): a mechanic's initials in their own color. Decorative; the name is always next to it or in a label. */
export function MechanicAvatar({ id, name, size = 'md', className }: { id: string; name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClass = size === 'lg' ? 'size-8' : size === 'sm' ? 'size-6' : 'size-7';
  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn('grid shrink-0 place-items-center rounded-full text-xs font-semibold', sizeClass, MECHANIC_TONE_CLASS[mechanicTone(id)], className)}
    >
      {profileInitials(name)}
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
