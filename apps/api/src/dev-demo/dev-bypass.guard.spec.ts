import { type ExecutionContext, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { DevBypassGuard, demoAccessGranted, devBypassEnabled } from './dev-bypass.guard';
import { DevDemoController } from './dev-demo.controller';

const KEYS = ['AUTH_DEV_BYPASS', 'DEMO_HOSTED', 'DEMO_ACCESS_CODE'] as const;
const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

function context(headers: Record<string, string> = {}): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as unknown as ExecutionContext;
}

describe('DevBypassGuard (D36)', () => {
  it('is only on with AUTH_DEV_BYPASS=true, the same switch as dev: tokens', () => {
    expect(devBypassEnabled({})).toBe(false);
    expect(devBypassEnabled({ AUTH_DEV_BYPASS: 'false' })).toBe(false);
    expect(devBypassEnabled({ AUTH_DEV_BYPASS: '1' })).toBe(false);
    expect(devBypassEnabled({ AUTH_DEV_BYPASS: 'true' })).toBe(true);
  });

  it('answers 404 without the flag, so production has no such route', () => {
    delete process.env.AUTH_DEV_BYPASS;
    expect(() => new DevBypassGuard().canActivate(context())).toThrow(NotFoundException);
    process.env.AUTH_DEV_BYPASS = 'true';
    expect(new DevBypassGuard().canActivate(context())).toBe(true);
  });

  it('on a published demo (D39) asks for the shared code, and lets nothing in without one configured', () => {
    expect(demoAccessGranted(undefined, {})).toBe(true);
    expect(demoAccessGranted(undefined, { DEMO_HOSTED: '1', DEMO_ACCESS_CODE: 'truck-603' })).toBe(false);
    expect(demoAccessGranted('wrong', { DEMO_HOSTED: '1', DEMO_ACCESS_CODE: 'truck-603' })).toBe(false);
    expect(demoAccessGranted(' truck-603 ', { DEMO_HOSTED: '1', DEMO_ACCESS_CODE: 'truck-603' })).toBe(true);
    expect(demoAccessGranted('anything', { DEMO_HOSTED: '1' })).toBe(false);

    process.env.AUTH_DEV_BYPASS = 'true';
    process.env.DEMO_HOSTED = '1';
    process.env.DEMO_ACCESS_CODE = 'truck-603';
    expect(() => new DevBypassGuard().canActivate(context())).toThrow(UnauthorizedException);
    expect(new DevBypassGuard().canActivate(context({ 'x-demo-access': 'truck-603' }))).toBe(true);
  });

  it('guards the demo users route before authentication', () => {
    const guards = Reflect.getMetadata('__guards__', DevDemoController) as unknown[];
    expect(guards[0]).toBe(DevBypassGuard);
  });
});
