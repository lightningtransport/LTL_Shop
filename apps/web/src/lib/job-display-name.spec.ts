import { describe, expect, it } from 'vitest';
import { getAdminMessages } from './admin-messages-catalog';
import { jobDisplayName } from './job-display-name';

describe('jobDisplayName (LTR-188 / D23)', () => {
  it('adds the helper suffix only to helper Jobs, in the viewer\'s language', () => {
    expect(jobDisplayName({ displayName: 'Air Leak', helperOfJobId: 'parent' }, getAdminMessages('es').helperJobSuffix)).toBe('Air Leak · ayudante');
    expect(jobDisplayName({ displayName: 'Air Leak', helperOfJobId: 'parent' }, getAdminMessages('en').helperJobSuffix)).toBe('Air Leak · helper');
    expect(jobDisplayName({ displayName: 'Air Leak', helperOfJobId: null }, ' · helper')).toBe('Air Leak');
    expect(jobDisplayName({ displayName: 'Air Leak' }, ' · helper')).toBe('Air Leak');
  });
});
