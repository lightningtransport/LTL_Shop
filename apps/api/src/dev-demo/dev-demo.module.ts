import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DevBypassGuard } from './dev-bypass.guard';
import { DevDemoController } from './dev-demo.controller';

@Module({
  imports: [AuthModule],
  controllers: [DevDemoController],
  providers: [DevBypassGuard],
})
export class DevDemoModule {}
