import { describe, expect, it } from 'vitest';
import { pmSaveStatus } from './pm-save-status';

describe('PM save status (LTR-151)', () => {
  const idle = { saving: false, dirty: false, saveError: null, savedOnce: false };

  it('shows nothing before the mechanic writes anything', () => {
    expect(pmSaveStatus(idle)).toBeNull();
    expect(pmSaveStatus({ ...idle, dirty: true })).toBeNull();
  });

  it('shows Saving while writing and Saved only after a write succeeded', () => {
    expect(pmSaveStatus({ ...idle, dirty: true, saving: true })).toBe('saving');
    expect(pmSaveStatus({ ...idle, savedOnce: true })).toBe('saved');
    expect(pmSaveStatus({ ...idle, savedOnce: true, dirty: true })).toBeNull();
  });

  it('shows the error instead of Saved after a failed write', () => {
    expect(pmSaveStatus({ ...idle, dirty: true, saveError: 'Network', savedOnce: true })).toBe('error');
  });
});
