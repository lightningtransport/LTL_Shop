import { describe, expect, it, vi } from 'vitest';
import { SupabaseAdminClient, SupabaseAdminError, readSupabaseAdminConfig } from './supabase-admin';

const CONFIG = { url: 'https://project.supabase.co', serviceRoleKey: 'service-key' };

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('SupabaseAdminClient (D22)', () => {
  it('reads the service configuration from either URL variable and reports unconfigured otherwise', () => {
    expect(readSupabaseAdminConfig({ SUPABASE_URL: 'https://a.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: 'k' })).toEqual({ url: 'https://a.supabase.co', serviceRoleKey: 'k' });
    expect(readSupabaseAdminConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://b.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' })).toEqual({ url: 'https://b.supabase.co', serviceRoleKey: 'k' });
    expect(readSupabaseAdminConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://b.supabase.co' })).toBeNull();
    expect(new SupabaseAdminClient(null).isConfigured()).toBe(false);
  });

  it('creates a confirmed user flagged must_change_password with the service role headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply(200, { id: 'auth-1' }));
    const client = new SupabaseAdminClient(CONFIG, fetchImpl);
    await expect(client.createUser({ email: 'ana@shop.test', password: 'Temp2345abcdEF', name: 'Ana' })).resolves.toEqual({ id: 'auth-1' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://project.supabase.co/auth/v1/admin/users');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer service-key');
    expect(JSON.parse(init.body)).toEqual({
      email: 'ana@shop.test',
      password: 'Temp2345abcdEF',
      email_confirm: true,
      app_metadata: { must_change_password: true },
      user_metadata: { name: 'Ana' },
    });
  });

  it('resets, clears the flag, and deletes through PUT/DELETE on the user id', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => reply(200, { id: 'auth-1' }));
    const client = new SupabaseAdminClient(CONFIG, fetchImpl);
    await client.resetPassword('auth-1', 'NewTemp2345abc');
    await client.clearMustChangePassword('auth-1');
    await client.deleteUser('auth-1');
    expect(fetchImpl.mock.calls.map(([url, init]) => [url, init.method, init.body ? JSON.parse(init.body) : null])).toEqual([
      ['https://project.supabase.co/auth/v1/admin/users/auth-1', 'PUT', { password: 'NewTemp2345abc', app_metadata: { must_change_password: true } }],
      ['https://project.supabase.co/auth/v1/admin/users/auth-1', 'PUT', { app_metadata: { must_change_password: false } }],
      ['https://project.supabase.co/auth/v1/admin/users/auth-1', 'DELETE', null],
    ]);
  });

  it('turns a GoTrue error body and a network failure into SupabaseAdminError', async () => {
    const refused = new SupabaseAdminClient(CONFIG, vi.fn().mockResolvedValue(reply(422, { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' })));
    const failure = await refused.createUser({ email: 'dup@shop.test', password: 'x', name: 'Dup' }).catch((error) => error);
    expect(failure).toBeInstanceOf(SupabaseAdminError);
    expect(failure).toMatchObject({ operation: 'create', status: 422, code: 'email_exists' });

    const offline = new SupabaseAdminClient(CONFIG, vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(offline.deleteUser('auth-1')).rejects.toMatchObject({ operation: 'delete', code: 'network' });

    await expect(new SupabaseAdminClient(null).deleteUser('auth-1')).rejects.toMatchObject({ code: 'not_configured' });
  });
});
