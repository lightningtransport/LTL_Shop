import { Injectable } from '@nestjs/common';

/**
 * D22 / LTR-187: the API creates and resets Supabase Auth accounts for the roster.
 *
 * A small fetch client over the GoTrue Admin API (`/auth/v1/admin/users`) so the API does not pull
 * `@supabase/supabase-js` into the request path. It needs `SUPABASE_URL` (or
 * `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`; without both it reports
 * `isConfigured() === false` and the roster keeps working without access accounts (local dev with
 * `AUTH_DEV_BYPASS`, the flow tests).
 *
 * The first-login rule lives in `app_metadata.must_change_password`: only the service role can
 * write `app_metadata`, so the web reads it from the JWT and the API clears it after a change
 * (`POST /auth/password-changed`).
 */

export const MUST_CHANGE_PASSWORD_KEY = 'must_change_password';

export type SupabaseAdminConfig = { url: string; serviceRoleKey: string };

export class SupabaseAdminError extends Error {
  constructor(
    readonly operation: 'create' | 'update' | 'delete',
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'SupabaseAdminError';
  }
}

export function readSupabaseAdminConfig(env: NodeJS.ProcessEnv = process.env): SupabaseAdminConfig | null {
  const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

@Injectable()
export class SupabaseAdminClient {
  private readonly config: SupabaseAdminConfig | null;
  private readonly fetchImpl: FetchLike;

  constructor(config?: SupabaseAdminConfig | null, fetchImpl?: FetchLike) {
    this.config = config === undefined ? readSupabaseAdminConfig() : config;
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  /** Creates a confirmed user that must change the temporary password on first login. */
  async createUser(input: { email: string; password: string; name: string }): Promise<{ id: string }> {
    const body = await this.call('create', 'POST', '/auth/v1/admin/users', {
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { [MUST_CHANGE_PASSWORD_KEY]: true },
      user_metadata: { name: input.name },
    });
    const id = typeof body?.id === 'string' ? body.id : null;
    if (!id) throw new SupabaseAdminError('create', 200, null, 'Supabase did not return the new user id.');
    return { id };
  }

  /** Sets a new temporary password and re-arms the first-login change. */
  async resetPassword(authId: string, password: string): Promise<void> {
    await this.call('update', 'PUT', `/auth/v1/admin/users/${encodeURIComponent(authId)}`, {
      password,
      app_metadata: { [MUST_CHANGE_PASSWORD_KEY]: true },
    });
  }

  /** Clears the first-login flag after the person changed the password themselves. */
  async clearMustChangePassword(authId: string): Promise<void> {
    await this.call('update', 'PUT', `/auth/v1/admin/users/${encodeURIComponent(authId)}`, {
      app_metadata: { [MUST_CHANGE_PASSWORD_KEY]: false },
    });
  }

  /** Rollback helper: removes an auth user whose Shop row could not be written. */
  async deleteUser(authId: string): Promise<void> {
    await this.call('delete', 'DELETE', `/auth/v1/admin/users/${encodeURIComponent(authId)}`);
  }

  private async call(
    operation: SupabaseAdminError['operation'],
    method: 'POST' | 'PUT' | 'DELETE',
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    if (!this.config) {
      throw new SupabaseAdminError(operation, 0, 'not_configured', 'Supabase Auth admin is not configured.');
    }
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.config.url}${path}`, {
        method,
        headers: {
          apikey: this.config.serviceRoleKey,
          Authorization: `Bearer ${this.config.serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
    } catch (error) {
      throw new SupabaseAdminError(operation, 0, 'network', error instanceof Error ? error.message : 'Supabase Auth is unreachable.');
    }
    const text = await response.text();
    let body: Record<string, unknown> | null = null;
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      const code = typeof body?.error_code === 'string' ? body.error_code : typeof body?.code === 'string' ? body.code : null;
      const message = typeof body?.msg === 'string' ? body.msg
        : typeof body?.message === 'string' ? body.message
        : typeof body?.error === 'string' ? body.error
        : `Supabase Auth admin ${operation} failed (${response.status}).`;
      throw new SupabaseAdminError(operation, response.status, code, message);
    }
    return body;
  }
}
