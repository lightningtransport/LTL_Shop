import { describe, expect, it, vi } from 'vitest';
import { InvoiceFiles } from './invoice-files';

const config = { url: 'https://example.supabase.co', serviceRoleKey: 'service-key' };

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

describe('InvoiceFiles (LTR-200 / PC-2)', () => {
  it('without Storage settings, files are off with a clear code', async () => {
    await expect(new InvoiceFiles(null).uploadUrl('2026-10/x/a.pdf')).rejects.toMatchObject({ response: { code: 'FILES_NOT_CONFIGURED' } });
  });

  it('creates the private bucket on first use and returns an absolute upload URL', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(reply(404, { error: 'Bucket not found' }))
      .mockResolvedValueOnce(reply(200, { name: 'invoices' }))
      .mockResolvedValueOnce(reply(200, { url: '/object/upload/sign/invoices/2026-10/x/a.pdf?token=t' }));
    const files = new InvoiceFiles(config, fetchImpl);
    await expect(files.uploadUrl('2026-10/x/a.pdf')).resolves.toBe('https://example.supabase.co/storage/v1/object/upload/sign/invoices/2026-10/x/a.pdf?token=t');
    const create = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(create).toMatchObject({ id: 'invoices', public: false, file_size_limit: 10 * 1024 * 1024 });
    expect(fetchImpl.mock.calls[2][1].headers.authorization).toBe('Bearer service-key');
  });

  it('opens a file with a 5-minute link', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(reply(200, { signedURL: '/object/sign/invoices/p.pdf?token=s' }));
    const url = await new InvoiceFiles(config, fetchImpl).downloadUrl('p.pdf', 'Invoice 1.pdf');
    expect(url).toBe('https://example.supabase.co/storage/v1/object/sign/invoices/p.pdf?token=s&download=Invoice%201.pdf');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ expiresIn: 300 });
  });
});
