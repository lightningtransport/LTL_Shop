import { describe, expect, it } from 'vitest';
import { passwordResetRedirectUrl } from './site-url';

describe('passwordResetRedirectUrl', () => {
  it('keeps a local browser origin for local recovery links', () => {
    expect(passwordResetRedirectUrl('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000/reset-password');
  });

  it('uses the canonical production URL when configured', () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ltl-shop-web.vercel.app';
    expect(passwordResetRedirectUrl()).toBe('https://ltl-shop-web.vercel.app/reset-password');
    process.env.NEXT_PUBLIC_SITE_URL = previous;
  });
});
