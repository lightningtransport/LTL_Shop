import { Injectable } from '@nestjs/common';

const DEFAULT_URL = 'https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting';
const TIMEOUT_MS = 3_500;

@Injectable()
export class AgentReportingClient {
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async fetchReports(): Promise<{
    available: boolean;
    trucks: unknown;
    returns: unknown;
    driverPay: unknown;
  }> {
    const key = this.env.AGENT_REPORTING_KEY?.trim();
    if (!key) {
      return { available: false, trucks: null, returns: null, driverPay: null };
    }

    const [trucks, returns, driverPay] = await Promise.all([
      this.fetchReport('trucks', key),
      this.fetchReport('returns', key),
      this.fetchReport('driver_pay', key),
    ]);
    return { available: true, trucks, returns, driverPay };
  }

  private async fetchReport(report: string, key: string): Promise<unknown> {
    const base = (this.env.AGENT_REPORTING_URL ?? DEFAULT_URL).replace(/\/$/, '');
    const url = `${base}?report=${encodeURIComponent(report)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url, {
        headers: { 'x-agent-key': key, accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return await response.json() as unknown;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
