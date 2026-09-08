import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toSharedCapability } from '../auth/capabilities';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listMechanics() {
    const mechanics = await this.prisma.user.findMany({
      where: {
        active: true,
        capabilities: { some: { capability: 'MECHANIC_STANDARD' } },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        pmAuthorized: true,
        capabilities: { select: { capability: true } },
      },
    });
    return mechanics.map((mechanic) => ({
      ...mechanic,
      capabilities: mechanic.capabilities.map(({ capability }) => toSharedCapability(capability)),
    }));
  }
}
