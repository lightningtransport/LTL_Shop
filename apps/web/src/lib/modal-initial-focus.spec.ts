import { describe, expect, it } from 'vitest';
import { shouldTakeInitialFocus } from './modal-initial-focus';

describe('Dialog initial focus (R10)', () => {
  const name = { id: 'name' };
  const email = { id: 'email' };
  const trigger = { id: 'trigger' };
  const content = { contains: (node: unknown) => node === name || node === email || node === content };

  it('focuses the first field while focus is still outside the dialog or on the dialog box', () => {
    expect(shouldTakeInitialFocus(content, trigger)).toBe(true);
    expect(shouldTakeInitialFocus(content, null)).toBe(true);
    expect(shouldTakeInitialFocus(content, content)).toBe(true);
  });

  it('never takes focus from a field the person is already typing in', () => {
    expect(shouldTakeInitialFocus(content, email)).toBe(false);
    expect(shouldTakeInitialFocus(content, name)).toBe(false);
  });
});
