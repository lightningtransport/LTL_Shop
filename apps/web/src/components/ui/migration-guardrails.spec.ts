import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');
const legacyBarrel = join(sourceRoot, 'components', 'ui.tsx');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|tsx|css)$/.test(entry) && !entry.includes('.spec.')
        ? [path]
        : [];
  });
}

describe('shadcn migration guardrails', () => {
  it('keeps the compatibility barrel removed', () => {
    expect(existsSync(legacyBarrel)).toBe(false);
  });

  it('requires direct primitive or documented composition imports', () => {
    const violations = sourceFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return /from\s+['"](?:@\/components\/ui|\.\.?\/(?:.*\/)?ui)['"]/.test(source)
        ? [relative(sourceRoot, path)]
        : [];
    });

    expect(violations).toEqual([]);
  });

  it('rejects retired utility components and ad hoc interactive controls', () => {
    const violations = sourceFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      const isPrimitive = path.endsWith('/ui/native-select.tsx');
      const retiredClass = /(?:className=["']|cn\(\s*["'])(?:[^"']*\s)?(?:btn(?:-\w+)?|card|field)(?=\s|["'])/.test(source);
      const rawControl = !isPrimitive && /<(?:button|select)\b/.test(source);
      return retiredClass || rawControl ? [relative(sourceRoot, path)] : [];
    });

    expect(violations).toEqual([]);
  });
});
