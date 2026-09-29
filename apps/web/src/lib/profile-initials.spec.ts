import { describe, expect, it } from 'vitest';
import { profileInitials } from './profile-initials';

describe('profileInitials (LTR-167)', () => {
  it('uses the first letter of the first two words', () => {
    expect(profileInitials('Shop Manager')).toBe('SM');
    expect(profileInitials('Alejandro 1')).toBe('A1');
    expect(profileInitials('Alejandro Guadalupe Hernández Rodríguez')).toBe('AG');
  });

  it('uses two letters of a single word and trims spaces', () => {
    expect(profileInitials('  daniel  ')).toBe('DA');
    expect(profileInitials('Ñ')).toBe('Ñ');
  });

  it('never returns an empty button label', () => {
    expect(profileInitials('   ')).toBe('?');
  });
});
