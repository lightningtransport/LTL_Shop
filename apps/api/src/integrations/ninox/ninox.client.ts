import { Injectable } from '@nestjs/common';
import { getNinoxMappingSummary } from './ninox.mapping';

/**
 * Ninox adapter stub. Shop go-live uses Supabase/Prisma as the source of
 * truth (`DATA_SOURCE=supabase`). This client does not read or write Ninox.
 *
 * Verified MappingTool join (do not invent more IDs):
 * Shop `truckNumber` ↔ `trucks.truck_number` ↔ Ninox TrucksDB `E.A`.
 * `E.TA` is Ninox `mechanic_status` and is not Yard Work Plan phase.
 * The UC trailer target is unresolved in Ninox.
 *
 * Do not set `DATA_SOURCE=ninox` until a real adapter exists behind
 * repository interfaces. Current code has no NINOX_* env readers and
 * no Prisma table-id columns.
 */
@Injectable()
export class NinoxClient {
  isEnabled() {
    return (process.env.DATA_SOURCE ?? 'supabase') === 'ninox';
  }

  async ping(): Promise<{
    ok: boolean;
    message: string;
    live: boolean;
    mapping: ReturnType<typeof getNinoxMappingSummary>;
  }> {
    const mapping = getNinoxMappingSummary();
    if (!this.isEnabled()) {
      return {
        ok: true,
        live: false,
        message: 'Ninox deferred; DATA_SOURCE=supabase. Shop trucks join Ninox only by truckNumber ↔ E.A when a future sync is approved.',
        mapping,
      };
    }
    return {
      ok: false,
      live: false,
      message: 'Ninox adapter not implemented. Keep DATA_SOURCE=supabase for shop go-live.',
      mapping,
    };
  }
}
