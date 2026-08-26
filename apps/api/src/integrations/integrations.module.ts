import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { NinoxClient } from './ninox/ninox.client';

@Module({
  controllers: [IntegrationsController],
  providers: [NinoxClient],
  exports: [NinoxClient],
})
export class IntegrationsModule {}
