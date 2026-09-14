import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webSrc = resolve(__dirname);

describe('LTR-30 PWA safe-area shell', () => {
  it('keeps viewport-fit=cover and shared inset tokens', () => {
    const layout = readFileSync(resolve(webSrc, 'layout.tsx'), 'utf8');
    const css = readFileSync(resolve(webSrc, 'globals.css'), 'utf8');
    const adminShell = readFileSync(resolve(webSrc, '../components/admin-shell.tsx'), 'utf8');

    expect(layout).toContain("viewportFit: 'cover'");
    expect(css).toContain('--app-safe-top');
    expect(css).toContain('env(safe-area-inset-top');
    expect(css).toContain('constant(safe-area-inset-top)');
    expect(css).toContain('.app-safe-top');
    expect(css).toContain('.app-safe-bottom');
    expect(adminShell).toContain('app-safe-top');
    expect(adminShell).toContain('app-safe-bottom');
  });
});
