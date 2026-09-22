import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { CapabilitiesGuard } from './capabilities.guard';
import { SystemAdminGuard } from './system-admin.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthGuard, CapabilitiesGuard, SystemAdminGuard],
  exports: [AuthGuard, CapabilitiesGuard, SystemAdminGuard],
})
export class AuthModule {}
