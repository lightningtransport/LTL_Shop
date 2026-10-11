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

  it('shows the role code of a demo roster name (D36)', () => {
    expect(profileInitials('MG1 · Mecánico General')).toBe('MG1');
    expect(profileInitials('MG2 · Mecánico General')).toBe('MG2');
    expect(profileInitials('QC2 · Quality Check')).toBe('QC2');
    expect(profileInitials('MS · Manager Shop')).toBe('MS');
    expect(profileInitials('MG · Mecánico')).toBe('M·');
  });

  it('never returns an empty button label', () => {
    expect(profileInitials('   ')).toBe('?');
  });
});
