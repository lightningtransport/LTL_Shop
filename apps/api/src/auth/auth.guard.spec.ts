import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, tokenUsesSharedSecret } from './auth.guard';

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

describe('AuthGuard on a published demo (D39, DP3)', () => {
  const keys = ['AUTH_DEV_BYPASS', 'DEMO_HOSTED', 'DEMO_ACCESS_CODE'] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
  const context = (headers: Record<string, string>) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;

  it('refuses a dev: token without the shared code, before looking the user up', async () => {
    process.env.AUTH_DEV_BYPASS = 'true';
    process.env.DEMO_HOSTED = '1';
    process.env.DEMO_ACCESS_CODE = 'truck-603';
    const prisma = { user: { findFirst: vi.fn(), findUnique: vi.fn() } } as unknown as PrismaService;
    const guard = new AuthGuard(prisma);
    await expect(guard.canActivate(context({ authorization: 'Bearer dev:ms@lightning.local' }))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(context({ authorization: 'Bearer dev:ms@lightning.local', 'x-demo-access': 'nope' }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});
