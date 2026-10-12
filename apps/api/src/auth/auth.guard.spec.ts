import { describe, expect, it } from 'vitest';
import { tokenUsesSharedSecret } from './auth.guard';

// Header-only tokens: the guard reads `alg` without verifying anything (PF9).
const HS256_HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const ES256_HEADER = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'k1' })).toString('base64url');

describe('tokenUsesSharedSecret (PF9)', () => {
  it('sends a legacy HS256 token straight to the shared secret, skipping the JWKS attempt', () => {
    expect(tokenUsesSharedSecret(`${HS256_HEADER}.e30.sig`)).toBe(true);
  });

  it('keeps asymmetric tokens and garbage on the JWKS path', () => {
    expect(tokenUsesSharedSecret(`${ES256_HEADER}.e30.sig`)).toBe(false);
    expect(tokenUsesSharedSecret('dev:someone@example.com')).toBe(false);
    expect(tokenUsesSharedSecret('')).toBe(false);
  });
});
