import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@ltl-shop/shared';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.MANAGER, UserRole.ADMIN)
export class AdminController {
  @Get('access')
  access(@Req() request: Request) {
    return { user: request.user };
  }
}
