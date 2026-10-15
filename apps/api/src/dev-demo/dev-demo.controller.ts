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
    // LTR-211 (UX-6-006): every demo build creates its Work Orders with new ids, so the first one tells the panel
    // which build this is; the stories it remembers as done reset when the data is rebuilt (nightly or by hand).
    const first = await this.prisma.workOrder.findFirst({ orderBy: { displayId: 'asc' }, select: { id: true } });
    return {
      build: first?.id ?? null,
      users: users.map((user) => ({
        ...user,
        capabilities: user.capabilities.map(({ capability }) => toSharedCapability(capability)),
      })),
    };
  }
}

/**
 * D39 (DP3): the published demo asks for its access code before showing anything; this answers whether the code
 * sent in `x-demo-access` is the right one (DevBypassGuard checks it), with no sign-in needed yet.
 */
@Controller('dev/demo')
@UseGuards(DevBypassGuard)
export class DevDemoAccessController {
  @Get('access')
  access() {
    return { ok: true };
  }
}
