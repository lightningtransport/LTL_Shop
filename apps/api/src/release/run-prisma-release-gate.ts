import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import {
  assertApprovedReleasePath,
  evaluateMigrateStatus,
  parseReleaseGateArgs,
  redactSecrets,
  shouldRunVercelBuildGate,
  verifyApiReads,
} from './prisma-release-gate';

const apiRoot = path.resolve(__dirname, '../..');

function logSafe(message: string): void {
  process.stdout.write(`${redactSecrets(message)}\n`);
}

function logSafeErr(message: string): void {
  process.stderr.write(`${redactSecrets(message)}\n`);
}

function runPrisma(args: string[]): { output: string; status: number } {
  const result = spawnSync('npx', ['prisma', ...args], {
    cwd: apiRoot,
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) {
    throw result.error;
  }
  return { output, status: result.status ?? 1 };
}

async function main(): Promise<void> {
  const flags = parseReleaseGateArgs(process.argv.slice(2));

  if (flags.vercelBuild && !shouldRunVercelBuildGate()) {
    logSafe('Prisma release gate skipped (set PRISMA_RELEASE_GATE=1 on production to enforce migrate status before build).');
    return;
  }

  if (flags.deploy) {
    assertApprovedReleasePath();
  }

  if (flags.status || flags.deploy) {
    const statusRun = runPrisma(['migrate', 'status']);
    const evaluated = evaluateMigrateStatus(statusRun.output, statusRun.status);
    logSafe(`Prisma migrate status: ${evaluated.kind}. ${evaluated.message}`);
    logSafe(statusRun.output);

    if (evaluated.kind === 'failed' || evaluated.kind === 'drift' || evaluated.kind === 'unknown') {
      process.exitCode = 1;
      logSafeErr('Release gate failed: Prisma migration status is not safe to continue.');
      return;
    }

    if (flags.deploy) {
      if (evaluated.kind === 'pending') {
        logSafe('Applying pending migrations with prisma migrate deploy (approved release path).');
        const deployRun = runPrisma(['migrate', 'deploy']);
        logSafe(deployRun.output);
        if (deployRun.status !== 0) {
          process.exitCode = 1;
          logSafeErr('Release gate failed: prisma migrate deploy exited non-zero.');
          return;
        }
      } else {
        logSafe('No pending migrations to apply.');
      }

      const after = runPrisma(['migrate', 'status']);
      const afterEval = evaluateMigrateStatus(after.output, after.status);
      logSafe(`Prisma migrate status after deploy: ${afterEval.kind}. ${afterEval.message}`);
      logSafe(after.output);
      if (!afterEval.ok) {
        process.exitCode = 1;
        logSafeErr('Release gate failed: schema is not up to date after migrate deploy.');
        return;
      }
    } else if (!evaluated.ok && (flags.requireUpToDate || flags.vercelBuild)) {
      process.exitCode = 1;
      logSafeErr('Release gate failed: pending or unconfirmed Prisma migrations. Apply them through the approved release workflow before deploying application code.');
      return;
    }
  }

  if (flags.verifyApi) {
    const baseUrl = process.env.API_BASE_URL ?? '';
    const probes = await verifyApiReads(baseUrl);
    for (const probe of probes) {
      logSafe(`Verified ${probe.url} HTTP ${probe.status} ok=${probe.ok}`);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logSafeErr(message);
  process.exitCode = 1;
});
