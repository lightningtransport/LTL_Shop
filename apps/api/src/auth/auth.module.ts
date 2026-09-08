import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { CapabilitiesGuard } from './capabilities.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthGuard, CapabilitiesGuard],
  exports: [AuthGuard, CapabilitiesGuard],
})
export class AuthModule {}
