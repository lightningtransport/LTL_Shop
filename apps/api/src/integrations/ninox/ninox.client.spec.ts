import { afterEach, describe, expect, it } from 'vitest';
import { NinoxClient } from './ninox.client';

const originalDataSource = process.env.DATA_SOURCE;

afterEach(() => {
  process.env.DATA_SOURCE = originalDataSource;
});

describe('NinoxClient stub', () => {
  it('reports deferred success when DATA_SOURCE is supabase', async () => {
    process.env.DATA_SOURCE = 'supabase';
    const client = new NinoxClient();

    expect(client.isEnabled()).toBe(false);
    await expect(client.ping()).resolves.toMatchObject({
      ok: true,
      live: false,
      mapping: {
        liveClient: false,
        truckJoin: { ninoxPath: 'E.A', shopField: 'truckNumber' },
        unresolved: { ucTrailer: { tableId: null } },
      },
    });
  });

  it('fails closed when DATA_SOURCE=ninox because no live adapter exists', async () => {
    process.env.DATA_SOURCE = 'ninox';
    const client = new NinoxClient();

    expect(client.isEnabled()).toBe(true);
    await expect(client.ping()).resolves.toMatchObject({
      ok: false,
      live: false,
      message: expect.stringContaining('not implemented'),
    });
  });
});
