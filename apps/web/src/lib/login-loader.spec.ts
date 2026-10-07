import { describe, expect, it } from 'vitest';
import { LOGIN_LOADER_MS, LOGIN_LOADER_REDUCED_MS, loginLoaderDuration } from './login-loader';

const base = { param: null, seen: false, webdriver: false, reducedMotion: false };

describe('login loader (owner request 2026-10-06)', () => {
  it('shows one full cycle the first time in a browser session', () => {
    expect(loginLoaderDuration(base)).toBe(LOGIN_LOADER_MS);
  });

  it('does not replay after a sign-out in the same session, nor under automation', () => {
    expect(loginLoaderDuration({ ...base, seen: true })).toBe(0);
    expect(loginLoaderDuration({ ...base, webdriver: true })).toBe(0);
  });

  it('is short with reduced motion', () => {
    expect(loginLoaderDuration({ ...base, reducedMotion: true })).toBe(LOGIN_LOADER_REDUCED_MS);
  });

  it('?loader=1 forces it and ?loader=0 skips it', () => {
    expect(loginLoaderDuration({ ...base, param: '1', seen: true, webdriver: true })).toBe(LOGIN_LOADER_MS);
    expect(loginLoaderDuration({ ...base, param: '0' })).toBe(0);
  });
});
