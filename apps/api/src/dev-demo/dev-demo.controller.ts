import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { toSharedCapability } from '../auth/capabilities';
import { PrismaService } from '../prisma/prisma.service';
import { DevBypassGuard } from './dev-bypass.guard';

/**
 * D36: the local demo panel switches between demo accounts without signing in again. The list comes
 * from the database so the panel never offers an account whose `dev:` login would be refused.
 * `DevBypassGuard` runs first: without AUTH_DEV_BYPASS the route does not exist.
 */
@Controller('dev/demo')
@UseGuards(DevBypassGuard, AuthGuard)
export class DevDemoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  async users() {
    const users = await this.prisma.user.findMany({
      where: { active: true, removedAt: null },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        capabilities: { select: { capability: true } },
      },
    });
    return {
      users: users.map((user) => ({
        ...user,
        capabilities: user.capabilities.map(({ capability }) => toSharedCapability(capability)),
      })),
    };
  }
}
