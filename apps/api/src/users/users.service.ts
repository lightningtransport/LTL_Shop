import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  listMechanics() {
    return this.prisma.user.findMany({
      where: { active: true, role: 'mechanic' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true },
    });
  }
}
