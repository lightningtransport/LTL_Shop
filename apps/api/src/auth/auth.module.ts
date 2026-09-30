import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { CapabilitiesGuard } from './capabilities.guard';
import { RosterWritesGuard } from './roster-writes.guard';
import { SupabaseAdminClient } from './supabase-admin';
import { SystemAdminGuard } from './system-admin.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthGuard,
    CapabilitiesGuard,
    SystemAdminGuard,
    RosterWritesGuard,
    // Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY at boot; unconfigured is a valid state (local dev).
    { provide: SupabaseAdminClient, useFactory: () => new SupabaseAdminClient() },
  ],
  exports: [AuthGuard, CapabilitiesGuard, SystemAdminGuard, RosterWritesGuard, SupabaseAdminClient],
})
export class AuthModule {}
