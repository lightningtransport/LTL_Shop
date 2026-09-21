import { describe, expect, it, vi } from 'vitest';
import {
  AGENT_REPORTING_PAGE_SIZE,
  AgentReportingClient,
  AgentReportingConfigError,
  DEFAULT_AGENT_REPORTING_URL,
  getAgentReportingConfig,
} from './agent-reporting.client';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('getAgentReportingConfig', () => {
  it('returns null when the server-only key is missing', () => {
    expect(getAgentReportingConfig({})).toBeNull();
    expect(getAgentReportingConfig({ AGENT_REPORTING_KEY: '   ' })).toBeNull();
  });

  it('uses the documented default HTTPS gateway', () => {
    expect(getAgentReportingConfig({ AGENT_REPORTING_KEY: 'secret' })).toEqual({
      url: DEFAULT_AGENT_REPORTING_URL,
      key: 'secret',
      timeoutMs: 20_000,
    });
  });

  it('rejects a non-HTTPS override URL', () => {
    expect(() =>
      getAgentReportingConfig({
        AGENT_REPORTING_KEY: 'secret',
        AGENT_REPORTING_URL: 'http://example.supabase.co/functions/v1/agent-reporting',
      }),
    ).toThrow(AgentReportingConfigError);
  });
});

describe('AgentReportingClient', () => {
  const config = {
    url: DEFAULT_AGENT_REPORTING_URL,
    key: 'test-agent-key',
    timeoutMs: 1_000,
  };

  it('paginates with next_offset until has_more is false', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ truck_number: 101, yard_location: '301 Yard' }],
          has_more: true,
          next_offset: 1000,
          as_of: '2026-09-21T12:00:00.000Z',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ truck_number: 202, yard_location: 'Vendor' }],
          has_more: false,
          next_offset: null,
          as_of: '2026-09-21T12:00:01.000Z',
        }),
      );

    const client = new AgentReportingClient(config, fetchImpl as unknown as typeof fetch);
    const result = await client.listAll('trucks');

    expect(result.rows).toHaveLength(2);
    expect(result.asOf).toBe('2026-09-21T12:00:01.000Z');
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const firstUrl = String(fetchImpl.mock.calls[0][0]);
    const secondUrl = String(fetchImpl.mock.calls[1][0]);
    expect(firstUrl).toContain('report=trucks');
    expect(firstUrl).toContain(`limit=${AGENT_REPORTING_PAGE_SIZE}`);
    expect(firstUrl).toContain('offset=0');
    expect(secondUrl).toContain('offset=1000');
    expect(firstUrl).not.toContain('test-agent-key');
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: { 'x-agent-key': 'test-agent-key', Accept: 'application/json' },
    });
  });

  it('sends driver_pay date anchors without putting the key in the URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ data: [], has_more: false, next_offset: null }),
    );
    const client = new AgentReportingClient(config, fetchImpl as unknown as typeof fetch);

    await client.listAll('driver_pay', { out_from: '2026-09-21', out_to: '2026-10-04' });

    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toContain('report=driver_pay');
    expect(url).toContain('out_from=2026-09-21');
    expect(url).toContain('out_to=2026-10-04');
    expect(url).not.toContain('include_sensitive');
    expect(url).not.toContain(config.key);
  });

  it('treats HTTP 416 as the end of the list', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'range' }, 416));
    const client = new AgentReportingClient(config, fetchImpl as unknown as typeof fetch);
    await expect(client.listAll('returns')).resolves.toEqual({ rows: [], asOf: null });
  });

  it('sanitizes upstream failures without echoing the key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 500));
    const client = new AgentReportingClient(config, fetchImpl as unknown as typeof fetch);
    await expect(client.listAll('trucks')).rejects.toThrow('agent-reporting failed with HTTP 500');
  });
});
