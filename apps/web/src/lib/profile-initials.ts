/**
 * LTR-167: two letters for the header profile button, from the first two words of the name
 * ("Shop Manager" → "SM", "Alejandro 1" → "A1"). A single word gives its first two letters.
 */
export function profileInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const letters = words.length > 1 ? `${[...words[0]][0]}${[...words[1]][0]}` : [...words[0]].slice(0, 2).join('');
  return letters.toLocaleUpperCase();
}
