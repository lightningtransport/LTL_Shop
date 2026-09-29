import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { File, Reporter, Task } from 'vitest';

type Row = { id: string; title: string; result: string };

function order(id: string) {
  const [, group, number, suffix] = /^([A-Z]+)(\d+)(\w*)$/.exec(id) ?? [];
  return `${group === 'A' ? '0' : '1'}${group}${String(number).padStart(3, '0')}${suffix}`;
}

/** One markdown row per test named "<ID> | <title>", for docs/OPEN_ISSUES.md §0. */
export default class MatrixReporter implements Reporter {
  onFinished(files: File[] = []) {
    const rows: Row[] = [];
    const visit = (task: Task) => {
      if (task.type === 'suite') return task.tasks.forEach(visit);
      const match = /^([A-Z]+\d+\w*) \| (.+)$/.exec(task.name);
      if (!match) return;
      const [, id, title] = match;
      let result: string;
      if (task.mode === 'skip' || task.mode === 'todo') {
        result = title.includes('NO APLICA') ? 'NO APLICA' : 'SIN PROBAR';
      } else if (task.result?.state === 'pass') {
        result = 'PASA';
      } else {
        const message = task.result?.errors?.[0]?.message ?? 'sin resultado';
        result = `**FALLA** — ${message.split('\n')[0].replace(/\|/g, '\\|').slice(0, 400)}`;
      }
      rows.push({ id, title: title.replace(/\|/g, '\\|'), result });
    };
    files.forEach((file) => file.tasks.forEach(visit));
    rows.sort((left, right) => order(left.id).localeCompare(order(right.id)));

    const count = (prefix: string) => rows.filter((row) => row.result.startsWith(prefix)).length;
    const lines = [
      '# Matriz de flujos contra la API real',
      '',
      `PASA ${count('PASA')} · FALLA ${count('**FALLA')} · NO APLICA ${count('NO APLICA')} · SIN PROBAR ${count('SIN PROBAR')}`,
      '',
      '| # | Flujo | API real |',
      '|---|---|---|',
      ...rows.map((row) => `| ${row.id} | ${row.title} | ${row.result} |`),
      '',
    ];
    const directory = resolve(__dirname, 'results');
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, 'matrix.md'), lines.join('\n'));
    console.log(`\n${lines.join('\n')}`);
  }
}
