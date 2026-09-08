import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TrucksModule } from '../trucks/trucks.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, TrucksModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
