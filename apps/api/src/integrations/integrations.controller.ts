import { Controller, Get } from '@nestjs/common';
import { NinoxClient } from './ninox/ninox.client';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly ninox: NinoxClient) {}

  @Get('ninox/status')
  ninoxStatus() {
    return this.ninox.ping();
  }
}
