import { describe, expect, it } from 'vitest';
import { TEMPORARY_PASSWORD_LENGTH, generateTemporaryPassword, isTemporaryPasswordShape } from './temporary-password';

describe('generateTemporaryPassword (D22)', () => {
  it('is 14 readable characters with at least one letter and one digit, every time', () => {
    for (let index = 0; index < 500; index += 1) {
      const password = generateTemporaryPassword();
      expect(password).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
      expect(isTemporaryPasswordShape(password)).toBe(true);
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });

  it('does not repeat and refuses anything shorter than 12', () => {
    const passwords = new Set(Array.from({ length: 200 }, () => generateTemporaryPassword()));
    expect(passwords.size).toBe(200);
    expect(() => generateTemporaryPassword(8)).toThrow();
  });
});
