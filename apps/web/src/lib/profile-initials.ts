import { demoRosterCodeOf } from '@ltl-shop/shared';

/**
 * LTR-167: two letters for the header profile button, from the first two words of the name
 * ("Shop Manager" → "SM", "Alejandro 1" → "A1"). A single word gives its first two letters.
 * D36: a demo roster name ("MG1 · Mecánico General") shows its role code ("MG1"), so MG1 and MG2 differ.
 */
export function profileInitials(name: string) {
  const code = demoRosterCodeOf(name);
  if (code) return code;
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const letters = words.length > 1 ? `${[...words[0]][0]}${[...words[1]][0]}` : [...words[0]].slice(0, 2).join('');
  return letters.toLocaleUpperCase();
}
