export const DEFAULT_AGENT_REPORTING_URL =
  'https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting';

export const AGENT_REPORTING_PAGE_SIZE = 1000;
export const AGENT_REPORTING_MAX_PAGES = 40;

export const APPROVED_AGENT_REPORTS = [
  'trucks',
  'returns',
  'driver_pay',
  'settlements',
  'fuel',
  'drivers',
  'settlement_summary',
] as const;

export type ApprovedAgentReport = (typeof APPROVED_AGENT_REPORTS)[number];

export type YardAgentReport = 'trucks' | 'returns' | 'driver_pay';

export type AgentReportingConfig = {
  url: string;
  key: string;
  timeoutMs: number;
};

export class AgentReportingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentReportingConfigError';
  }
}

export class AgentReportingUpstreamError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AgentReportingUpstreamError';
  }
}

export function getAgentReportingConfig(
  env: NodeJS.ProcessEnv = process.env,
): AgentReportingConfig | null {
  const key = env.AGENT_REPORTING_KEY?.trim();
  if (!key) return null;

  const rawUrl = (env.AGENT_REPORTING_URL?.trim() || DEFAULT_AGENT_REPORTING_URL).replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AgentReportingConfigError('AGENT_REPORTING_URL must be a valid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new AgentReportingConfigError('AGENT_REPORTING_URL must use HTTPS');
  }

  return {
    url: rawUrl,
    key,
    timeoutMs: positiveInteger(env, 'AGENT_REPORTING_TIMEOUT_MS', 20_000),
  };
}

function positiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AgentReportingConfigError(`${name} must be a positive integer`);
  }
  return value;
}

export type AgentReportingPage = {
  data: Record<string, unknown>[];
  hasMore: boolean;
  nextOffset: number | null;
  asOf: string | null;
};

export type AgentReportingListResult = {
  rows: Record<string, unknown>[];
  asOf: string | null;
};

/**
 * GET-only client for Lightning `agent-reporting`.
 * The agent key is a header only. Never put it in the URL, logs, or DTO.
 */
export class AgentReportingClient {
  constructor(
    private readonly config: AgentReportingConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async listAll(
    report: YardAgentReport,
    filters: Record<string, string> = {},
  ): Promise<AgentReportingListResult> {
    const rows: Record<string, unknown>[] = [];
    let offset = 0;
    let asOf: string | null = null;

    for (let page = 0; page < AGENT_REPORTING_MAX_PAGES; page += 1) {
      const payload = await this.getPage(report, {
        ...filters,
        limit: String(AGENT_REPORTING_PAGE_SIZE),
        offset: String(offset),
      });
      if (payload.asOf) asOf = payload.asOf;
      rows.push(...payload.data);
      if (!payload.hasMore) return { rows, asOf };
      offset = payload.nextOffset ?? offset + (payload.data.length || AGENT_REPORTING_PAGE_SIZE);
    }

    return { rows, asOf };
  }

  private async getPage(
    report: YardAgentReport,
    params: Record<string, string>,
  ): Promise<AgentReportingPage> {
    const url = new URL(this.config.url);
    url.searchParams.set('report', report);
    for (const [key, value] of Object.entries(params)) {
      if (value !== '') url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          'x-agent-key': this.config.key,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (response.status === 416) {
        return { data: [], hasMore: false, nextOffset: null, asOf: null };
      }
      if (!response.ok) {
        throw new AgentReportingUpstreamError(
          `agent-reporting failed with HTTP ${response.status}`,
          response.status,
        );
      }
      const body = (await response.json()) as Record<string, unknown>;
      const data = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : [];
      return {
        data,
        hasMore: Boolean(body.has_more),
        nextOffset: typeof body.next_offset === 'number' ? body.next_offset : null,
        asOf: typeof body.as_of === 'string' ? body.as_of : null,
      };
    } catch (error) {
      if (error instanceof AgentReportingUpstreamError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AgentReportingUpstreamError('agent-reporting timed out');
      }
      throw new AgentReportingUpstreamError('agent-reporting request failed');
    } finally {
      clearTimeout(timeout);
    }
  }
}
