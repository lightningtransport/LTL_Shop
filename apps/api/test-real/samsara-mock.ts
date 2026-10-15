import { createServer, type IncomingMessage, type Server } from 'node:http';

/**
 * D35 / §1x: a stand-in for the Samsara REST API, so the flow tests never call the real Samsara. The API under test
 * points `SAMSARA_API_URL` here. Rows set the answer with `POST /__fixture` (see `setSamsaraFixture` in the harness).
 */
export type SamsaraFixture = {
  /** `id`, `name`, `vin` and, for D44, `make`, `model`, `year` (a string, as Samsara sends it) and `licensePlate`. */
  vehicles: Array<Record<string, unknown>>;
  /** Rows of `/fleet/vehicles/stats` for odometer and GPS (`id` plus the stat objects). */
  stats: Array<Record<string, unknown>>;
  /** Rows of `/fleet/vehicles/stats?types=faultCodes` (`id` plus `faultCodes`). */
  faults: Array<Record<string, unknown>>;
  /** `faults`: the faultCodes read answers 500 (miles and location still sync). */
  fail?: 'faults' | null;
};

export const EMPTY_SAMSARA_FIXTURE: SamsaraFixture = { vehicles: [], stats: [], faults: [], fail: null };

export const SAMSARA_TEST_TOKEN = 'flow-test-samsara-token';

export function startSamsaraMock(): Promise<{ url: string; close: () => Promise<void> }> {
  let fixture: SamsaraFixture = EMPTY_SAMSARA_FIXTURE;
  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://mock');
    const reply = (status: number, body: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };

    if (request.method === 'POST' && url.pathname === '/__fixture') {
      fixture = { ...EMPTY_SAMSARA_FIXTURE, ...(JSON.parse(await body(request)) as Partial<SamsaraFixture>) };
      return reply(200, { ok: true });
    }
    if (request.headers.authorization !== `Bearer ${SAMSARA_TEST_TOKEN}`) return reply(401, { message: 'Unauthorized' });

    const page = (data: unknown[]) => reply(200, { data, pagination: { endCursor: '', hasNextPage: false } });
    if (url.pathname === '/fleet/vehicles') return page(fixture.vehicles);
    if (url.pathname === '/fleet/vehicles/stats') {
      if (url.searchParams.get('types') === 'faultCodes') {
        return fixture.fail === 'faults' ? reply(500, { message: 'boom' }) : page(fixture.faults);
      }
      return page(fixture.stats);
    }
    return reply(404, { message: 'Not found' });
  });

  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolveServer({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

function body(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let text = '';
    request.on('data', (chunk) => { text += chunk; });
    request.on('end', () => resolveBody(text));
    request.on('error', reject);
  });
}
