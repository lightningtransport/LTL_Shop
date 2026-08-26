import { Injectable } from '@nestjs/common';
import { ActivityEventType } from '@ltl-shop/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type LogInput = {
  workOrderId?: string;
  eventType: ActivityEventType;
  entityType: string;
  entityId?: string;
  userId: string;
  previousValue?: unknown;
  newValue?: unknown;
  relevantValue?: unknown;
};

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ActivityLogService {
  async log(tx: DbClient, input: LogInput) {
    await tx.activityLog.create({
      data: {
        workOrderId: input.workOrderId,
        eventType: input.eventType as never,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId,
        previousValue: input.previousValue as Prisma.InputJsonValue,
        newValue: input.newValue as Prisma.InputJsonValue,
        relevantValue: input.relevantValue as Prisma.InputJsonValue,
      },
    });
  }
}
