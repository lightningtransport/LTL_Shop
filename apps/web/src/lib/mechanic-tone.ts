/**
 * Stage 8 (F5, mockups): each mechanic keeps one avatar color everywhere (Truck, Work Order, Yard). The color
 * comes from the mechanic's id, so it never depends on the order of a list.
 */
export const MECHANIC_TONES = ['sky', 'violet', 'emerald', 'rose', 'cyan', 'amber', 'slate'] as const;
export type MechanicTone = (typeof MECHANIC_TONES)[number];

export function mechanicTone(id: string): MechanicTone {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return MECHANIC_TONES[hash % MECHANIC_TONES.length];
}

/** Tailwind classes per tone (spelled out so Tailwind keeps them). Text is -700 / dark -300: AA on the 20% tint. */
export const MECHANIC_TONE_CLASS: Record<MechanicTone, string> = {
  sky: 'bg-sky-500/20 text-sky-700 dark:text-sky-300',
  violet: 'bg-violet-500/20 text-violet-700 dark:text-violet-300',
  emerald: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  rose: 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
  cyan: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300',
  amber: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  slate: 'bg-slate-500/20 text-slate-700 dark:text-slate-300',
};
