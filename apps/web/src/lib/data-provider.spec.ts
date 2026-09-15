import { describe, expect, it } from 'vitest';
import { sessionCacheAction } from './data-provider';

describe('sessionCacheAction', () => {
  it('does not touch the SWR cache on first token paint', () => {
    expect(sessionCacheAction(null, 'dev:manager@example.com')).toBe('none');
    expect(sessionCacheAction('tok', 'tok')).toBe('none');
  });

  it('revalidates on Bearer rotation instead of wiping data', () => {
    expect(sessionCacheAction('local-jwt', 'supabase-jwt')).toBe('revalidate');
  });

  it('clears cached Admin rows on logout', () => {
    expect(sessionCacheAction('tok', null)).toBe('clear');
  });
});
