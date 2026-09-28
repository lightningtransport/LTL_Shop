import { describe, expect, it } from 'vitest';
import { fillPlaceholders } from './admin-next-step';

describe('fillPlaceholders', () => {
  it('fills placeholders and keeps unknown ones', () => {
    expect(fillPlaceholders('{names} · {done}/{total} {x}', { names: 'MG', done: '1', total: '2' })).toBe('MG · 1/2 {x}');
  });
});
