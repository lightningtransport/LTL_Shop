import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { CapabilitiesGuard } from './capabilities.guard';
import { ManagerWritesGuard } from './manager-writes.guard';
import { SupabaseAdminClient } from './supabase-admin';

@Module({
  controllers: [AuthController],
  providers: [
    AuthGuard,
    CapabilitiesGuard,
    ManagerWritesGuard,
    // Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY at boot; unconfigured is a valid state (local dev).
    { provide: SupabaseAdminClient, useFactory: () => new SupabaseAdminClient() },
  ],
  exports: [AuthGuard, CapabilitiesGuard, ManagerWritesGuard, SupabaseAdminClient],
})
export class AuthModule {}
