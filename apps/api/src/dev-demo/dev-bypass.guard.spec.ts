import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { DevBypassGuard, devBypassEnabled } from './dev-bypass.guard';
import { DevDemoController } from './dev-demo.controller';

const original = process.env.AUTH_DEV_BYPASS;

afterEach(() => {
  if (original === undefined) delete process.env.AUTH_DEV_BYPASS;
  else process.env.AUTH_DEV_BYPASS = original;
});

describe('DevBypassGuard (D36)', () => {
  it('is only on with AUTH_DEV_BYPASS=true, the same switch as dev: tokens', () => {
    expect(devBypassEnabled({})).toBe(false);
    expect(devBypassEnabled({ AUTH_DEV_BYPASS: 'false' })).toBe(false);
    expect(devBypassEnabled({ AUTH_DEV_BYPASS: '1' })).toBe(false);
    expect(devBypassEnabled({ AUTH_DEV_BYPASS: 'true' })).toBe(true);
  });

  it('answers 404 without the flag, so production has no such route', () => {
    delete process.env.AUTH_DEV_BYPASS;
    expect(() => new DevBypassGuard().canActivate()).toThrow(NotFoundException);
    process.env.AUTH_DEV_BYPASS = 'true';
    expect(new DevBypassGuard().canActivate()).toBe(true);
  });

  it('guards the demo users route before authentication', () => {
    const guards = Reflect.getMetadata('__guards__', DevDemoController) as unknown[];
    expect(guards[0]).toBe(DevBypassGuard);
  });
});
