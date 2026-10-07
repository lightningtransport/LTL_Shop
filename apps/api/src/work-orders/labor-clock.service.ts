import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  ActivityEventType,
  AppCapability,
  DEFAULT_DAY_CLOSE_MINUTES,
  DEFAULT_WORKDAYS,
  UserRole,
  cutoffToMinutes,
  minutesToCutoff,
  updateShopHoursSchema,
  type ShopHoursDto,
} from '@ltl-shop/shared';
import type { Prisma } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { hasCapability } from '../auth/capabilities';
import { SHOP_TIME_ZONE } from '../common/shop-time';
import { PrismaService } from '../prisma/prisma.service';
import { closeDueSessions, sessionCloseAt, type DayCloseResult, type DayCloseSettings } from './day-close';
import { closeOtherClocks } from './labor-session';

const SETTINGS_ID = 1;
const NOTHING_CLOSED: DayCloseResult = { closed: 0, workOrderIds: [] };

/**
 * LTR-186: the mechanic's clock across Work Orders.
 * - D20 day close and the shop hours it reads. `closeDue()` is the lazy close every labor read and
 *   write calls first; the Vercel Cron endpoint calls it too.
 * - D21 one clock per mechanic: `closeOtherClocks()` on Start/Continue, `clockOf()` for the hint.
 */
@Injectable()
export class LaborClockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  /**
   * Close the sessions that are past their day close. Cheap when nothing is due: one read of the
   * open sessions (there are few), the settings row only when some are open, and writes only when
   * one is due. Pass `tx` to run inside the caller's transaction.
   */
  async closeDue(tx?: Prisma.TransactionClient, now: Date = new Date()): Promise<DayCloseResult> {
    const db = tx ?? this.prisma;
    const open = await db.workSession.findMany({
      where: { endedAt: null, startedAt: { lt: now } },
      select: { id: true, startedAt: true, workOrderId: true },
    });
    if (!open.length) return NOTHING_CLOSED;
    const settings = await this.settings(db);
    if (!open.some((session) => sessionCloseAt(session.startedAt, settings).getTime() <= now.getTime())) return NOTHING_CLOSED;
    if (tx) return closeDueSessions(tx, open, now, settings);
    return this.prisma.$transaction((client) => closeDueSessions(client, open, now, settings));
  }

  /** D21: stop the mechanic's clock on every other Work Order (Start/Continue on `workOrderId`). */
  closeOtherClocks(tx: Prisma.TransactionClient, userId: string, workOrderId: string, now: Date = new Date()) {
    return closeOtherClocks(tx, userId, workOrderId, now);
  }

  /** D21: the Work Order where this mechanic's clock runs now (at most one), or null. */
  async clockOf(userId: string, db: Prisma.TransactionClient = this.prisma) {
    const session = await db.workSession.findFirst({
      where: { userId, endedAt: null },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, workOrder: { select: { id: true, displayId: true, truck: { select: { truckNumber: true } } } } },
    });
    // Stage MG-1: `since` is when this clock started, for the mechanic's clock strip (MG1).
    return session
      ? { id: session.workOrder.id, displayId: session.workOrder.displayId, truckNumber: session.workOrder.truck.truckNumber, since: session.startedAt.toISOString() }
      : null;
  }

  async settings(db: Prisma.TransactionClient = this.prisma): Promise<DayCloseSettings> {
    const row = await this.row(db);
    return { cutoffMinutes: row.dayCloseMinutes, workdays: row.workdays, timeZone: SHOP_TIME_ZONE };
  }

  async getShopHours(): Promise<ShopHoursDto> {
    return toShopHoursDto(await this.row(this.prisma));
  }

  /** The Manager (work_orders.manage) or the System Admin; applies from now on. */
  async updateShopHours(user: AuthUser, raw: unknown): Promise<ShopHoursDto> {
    if (!hasCapability(user, AppCapability.WORK_ORDERS_MANAGE) && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only a Shop Manager or a System Admin can change the shop hours.');
    }
    const parsed = updateShopHoursSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'SHOP_HOURS_INVALID',
        message: 'The day close is a time between 12:00 and 23:59 and at least one workday.',
        errors: parsed.error.flatten(),
      });
    }
    const dayCloseMinutes = cutoffToMinutes(parsed.data.cutoff)!;
    const workdays = [...parsed.data.workdays].sort((left, right) => left - right);
    // What was already due under the old hours closes with the old hours; the new ones apply from now.
    await this.closeDue();
    const previous = await this.row(this.prisma);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.shopSettings.update({
        where: { id: SETTINGS_ID },
        data: { dayCloseMinutes, workdays, updatedById: user.id },
        include: { updatedBy: { select: { id: true, name: true } } },
      });
      await this.activity.log(tx, {
        eventType: ActivityEventType.MANAGER_CORRECTION,
        entityType: 'shop_settings',
        entityId: String(SETTINGS_ID),
        userId: user.id,
        previousValue: { cutoff: minutesToCutoff(previous.dayCloseMinutes), workdays: previous.workdays },
        newValue: { cutoff: minutesToCutoff(dayCloseMinutes), workdays },
      });
      return row;
    });
    return toShopHoursDto(updated);
  }

  /** The single settings row; created with the defaults the first time anyone reads it. */
  private async row(db: Prisma.TransactionClient) {
    const include = { updatedBy: { select: { id: true, name: true } } } as const;
    const existing = await db.shopSettings.findUnique({ where: { id: SETTINGS_ID }, include });
    if (existing) return existing;
    return db.shopSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID, dayCloseMinutes: DEFAULT_DAY_CLOSE_MINUTES, workdays: [...DEFAULT_WORKDAYS] },
      include,
    });
  }
}

function toShopHoursDto(row: {
  dayCloseMinutes: number;
  workdays: number[];
  updatedAt: Date;
  updatedBy: { id: string; name: string } | null;
}): ShopHoursDto {
  return {
    cutoff: minutesToCutoff(row.dayCloseMinutes),
    workdays: [...row.workdays].sort((left, right) => left - right),
    timeZone: SHOP_TIME_ZONE,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}
