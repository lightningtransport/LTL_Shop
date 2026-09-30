import { randomInt } from 'node:crypto';

/**
 * D22: the temporary password the Manager passes to a new person. Letters and digits only, no
 * characters that read alike (0/O, 1/l/I), always at least one letter and one digit, so it can be
 * read aloud or typed from a photo of the screen.
 */
export const TEMPORARY_PASSWORD_LENGTH = 14;

const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALPHABET = LETTERS + DIGITS;

export function generateTemporaryPassword(length = TEMPORARY_PASSWORD_LENGTH): string {
  if (length < 12) throw new Error('A temporary password needs at least 12 characters.');
  const chars: string[] = [];
  for (let index = 0; index < length; index += 1) {
    chars.push(ALPHABET[randomInt(ALPHABET.length)]);
  }
  // Guarantee both classes without biasing the rest: overwrite two random, distinct positions.
  const letterAt = randomInt(length);
  let digitAt = randomInt(length - 1);
  if (digitAt >= letterAt) digitAt += 1;
  chars[letterAt] = LETTERS[randomInt(LETTERS.length)];
  chars[digitAt] = DIGITS[randomInt(DIGITS.length)];
  return chars.join('');
}

export function isTemporaryPasswordShape(value: string, length = TEMPORARY_PASSWORD_LENGTH): boolean {
  return value.length === length
    && [...value].every((char) => ALPHABET.includes(char))
    && /[A-Za-z]/.test(value)
    && /\d/.test(value);
}
