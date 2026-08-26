import { Injectable } from '@nestjs/common';

/**
 * Ninox adapter placeholder. P0 uses Supabase as Source of Truth.
 * Set DATA_SOURCE=ninox later and implement this adapter behind repository interfaces.
 */
@Injectable()
export class NinoxClient {
  isEnabled() {
    return (process.env.DATA_SOURCE ?? 'supabase') === 'ninox';
  }

  async ping(): Promise<{ ok: boolean; message: string }> {
    if (!this.isEnabled()) {
      return { ok: true, message: 'Ninox deferred; DATA_SOURCE=supabase' };
    }
    return { ok: false, message: 'Ninox adapter not implemented in P0' };
  }
}
