import { describe, expect, it, vi } from 'vitest';
import { NinoxReadOnlyClient, getNinoxReadOnlyConfig } from './ninox.read-only-client';

const config = {
  baseUrl: 'https://lightningtransport.ninoxdb.com/v1',
  token: 'secret',
  teamId: 'team/id',
  databaseId: 'db 1',
  timeoutMs: 1000,
};

describe('NinoxReadOnlyClient', () => {
  it('GETs TrucksDB E records and encodes path segments', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, fields: { A: '905' } }],
    });
    const client = new NinoxReadOnlyClient(config, fetchImpl as unknown as typeof fetch);

    await expect(client.listTrucksDbRecords()).resolves.toEqual([{ id: 1, fields: { A: '905' } }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain('/teams/team%2Fid/databases/db%201/tables/E/records');
    expect(init).toMatchObject({ method: 'GET' });
  });

  it('refuses to read any table other than E', async () => {
    const fetchImpl = vi.fn();
    const client = new NinoxReadOnlyClient(config, fetchImpl as unknown as typeof fetch);
    await expect(client.listTableRecords('WD')).rejects.toThrow('TrucksDB E only');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('exposes no mutation method', () => {
    const client = new NinoxReadOnlyClient(config, vi.fn() as unknown as typeof fetch);
    expect('post' in client).toBe(false);
    expect('put' in client).toBe(false);
    expect('patch' in client).toBe(false);
    expect('delete' in client).toBe(false);
  });

  it('requires HTTPS Ninox config', () => {
    expect(() => getNinoxReadOnlyConfig({
      NINOX_BASE_URL: 'http://example.ninoxdb.com/v1',
      NINOX_TOKEN: 'x',
      NINOX_TEAM_ID: 't',
      NINOX_DATABASE_ID: 'd',
    })).toThrow('HTTPS');
  });
});
