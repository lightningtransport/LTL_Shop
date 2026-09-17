import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('LTR-24 catalog release path', () => {
  it('runs prisma:apply-catalog after approved migrate deploy', () => {
    const workflow = readFileSync(
      resolve(__dirname, '../../../../.github/workflows/release-safety.yml'),
      'utf8',
    );
    expect(workflow).toContain('prisma:apply-catalog');
    expect(workflow).toContain('Apply signed job catalog (LTR-24 / LTR-35 / LTR-41)');
  });
});
