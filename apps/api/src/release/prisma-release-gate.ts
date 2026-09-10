export type MigrateStatusKind =
  | 'up-to-date'
  | 'pending'
  | 'failed'
  | 'drift'
  | 'unknown';

export type MigrateStatusResult = {
  kind: MigrateStatusKind;
  ok: boolean;
  message: string;
};

const APPROVED_RELEASE_PATH_ENV = 'PRISMA_APPROVED_RELEASE_PATH';
const VERCEL_GATE_ENV = 'PRISMA_RELEASE_GATE';

export function redactSecrets(text: string): string {
  return text
    .replace(/postgresql:\/\/[^\s'"]+/gi, 'postgresql://***')
    .replace(/postgres:\/\/[^\s'"]+/gi, 'postgres://***')
    .replace(/\b(DATABASE_URL|DIRECT_URL|SUPABASE_[A-Z0-9_]+|API_BASE_URL)\s*[=:]\s*[^\s'"]+/gi, '$1=***')
    .replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9._-]+/g, '[redacted-jwt]')
    .replace(/at "[^"]+"/g, 'at "[redacted-host]"');
}

export function evaluateMigrateStatus(rawOutput: string, exitCode = 0): MigrateStatusResult {
  const output = rawOutput.replace(/\r\n/g, '\n');
  const failedNames = [
    ...output.matchAll(/The `([^`]+)` migration[\s\S]{0,80}failed/gi),
  ].map((match) => match[1]);
  const failed =
    failedNames.length > 0 ||
    /migrations? have failed/i.test(output) ||
    /failed migrations?/i.test(output);

  if (failed) {
    return {
      kind: 'failed',
      ok: false,
      message: failedNames.length
        ? `Prisma reported failed migration(s): ${failedNames.join(', ')}`
        : 'Prisma reported a failed migration.',
    };
  }

  if (
    /migration history and the migrations table are different/i.test(output) ||
    /drift detected/i.test(output)
  ) {
    return {
      kind: 'drift',
      ok: false,
      message: 'Prisma reported migration history drift. Do not deploy application code until resolved with Prisma.',
    };
  }

  const pendingBlock = output.match(
    /Following migrations? have not yet been applied:\n([\s\S]*?)(?:\n\n|\nTo apply|$)/i,
  );
  const pendingNames = pendingBlock
    ? pendingBlock[1]
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^\d{8,}/.test(line) || /^[0-9]{14,}_/.test(line))
    : [];
  const pending =
    pendingNames.length > 0 || /have not yet been applied/i.test(output) || /pending migration/i.test(output);

  if (pending) {
    return {
      kind: 'pending',
      ok: false,
      message: pendingNames.length
        ? `Pending Prisma migrations: ${pendingNames.join(', ')}`
        : 'Prisma reported pending migrations.',
    };
  }

  if (/Database schema is up to date/i.test(output)) {
    return {
      kind: 'up-to-date',
      ok: true,
      message: 'Database schema is up to date.',
    };
  }

  if (exitCode === 0) {
    return {
      kind: 'unknown',
      ok: false,
      message: 'prisma migrate status exited 0 but did not confirm that the schema is up to date.',
    };
  }

  return {
    kind: 'unknown',
    ok: false,
    message: `prisma migrate status failed with exit code ${exitCode}.`,
  };
}

export function assertApprovedReleasePath(env: NodeJS.ProcessEnv = process.env): void {
  if (env[APPROVED_RELEASE_PATH_ENV] !== '1') {
    throw new Error(
      `prisma migrate deploy is only allowed on the approved GitHub release path (${APPROVED_RELEASE_PATH_ENV}=1).`,
    );
  }
}

export function shouldRunVercelBuildGate(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[VERCEL_GATE_ENV] === '1';
}

export type HealthProbe = {
  url: string;
  ok: boolean;
  status: number;
  bodyPreview: string;
};

export function isHealthPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return (value as { ok?: unknown }).ok === true;
}

export function summarizeProbeBody(body: string): string {
  const redacted = redactSecrets(body).trim().replace(/\s+/g, ' ');
  return redacted.slice(0, 180);
}

export async function verifyApiReads(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<HealthProbe[]> {
  const origin = baseUrl.replace(/\/+$/, '');
  if (!origin) {
    throw new Error('API_BASE_URL is required for post-deploy verification.');
  }
  if (/[?&](access_token|token|apikey|key)=/i.test(origin) || origin.includes('@')) {
    throw new Error('API_BASE_URL must not include credentials.');
  }

  const targets = [`${origin}/api/health`, `${origin}/`];
  const probes: HealthProbe[] = [];

  for (const url of targets) {
    const response = await fetchImpl(url, { method: 'GET', redirect: 'manual' });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
    const ok = response.status === 200 && isHealthPayload(parsed);
    probes.push({
      url,
      ok,
      status: response.status,
      bodyPreview: summarizeProbeBody(text),
    });
    if (!ok) {
      throw new Error(`Post-deploy read failed: ${url} returned HTTP ${response.status}.`);
    }
  }

  return probes;
}

export function parseReleaseGateArgs(argv: string[]): {
  deploy: boolean;
  status: boolean;
  requireUpToDate: boolean;
  verifyApi: boolean;
  vercelBuild: boolean;
  allowPending: boolean;
} {
  const deploy = argv.includes('--deploy');
  const vercelBuild = argv.includes('--vercel-build');
  const verifyApi = argv.includes('--verify-api');
  const status = argv.includes('--status') || deploy || vercelBuild || argv.length === 0 || (!verifyApi && !deploy);
  return {
    deploy,
    status,
    requireUpToDate: argv.includes('--require-up-to-date') || (!deploy && status && !argv.includes('--allow-pending')),
    verifyApi,
    vercelBuild,
    allowPending: argv.includes('--allow-pending'),
  };
}
