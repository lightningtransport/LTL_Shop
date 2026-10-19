import { describe, expect, it } from 'vitest';
import { fillPlaceholders } from './admin-next-step';

describe('fillPlaceholders', () => {
  it('fills placeholders and keeps unknown ones', () => {
    expect(fillPlaceholders('{names} · {done}/{total} {x}', { names: 'MG', done: '1', total: '2' })).toBe('MG · 1/2 {x}');
  });
});

describe('fillPlaceholders plurals (mobile UI review)', () => {
  it('picks the word for the number, so a count never reads "1 Jobs"', () => {
    expect(fillPlaceholders('{count} {count:Job|Jobs} left', { count: '1' })).toBe('1 Job left');
    expect(fillPlaceholders('{count} {count:Job|Jobs} left', { count: '2' })).toBe('2 Jobs left');
    expect(fillPlaceholders('{count} {count:Job|Jobs} left', { count: '0' })).toBe('0 Jobs left');
    expect(fillPlaceholders('{count:Queda|Quedan} {count} · {job}', { count: '1', job: 'PM' })).toBe('Queda 1 · PM');
    expect(fillPlaceholders('{count:a|b}', {})).toBe('{count:a|b}');
  });
});
