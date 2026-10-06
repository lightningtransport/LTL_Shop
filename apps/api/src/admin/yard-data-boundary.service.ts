import { Injectable, Optional } from '@nestjs/common';
import { JobExternalKind, WorkOrderStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import {
  OPEN_WORK_ORDER_STATUSES,
  YARD_DATA_BOUNDARY_SECTION_MESSAGE,
  type YardDispatchShopTruckDto,
  type YardDataBoundaryDto,
  type YardDataBoundarySectionDto,
  type YardIncomingTruckItemDto,
  type YardUpcomingDepartureItemDto,
  type YardWorkLocationSectionDto,
} from '@ltl-shop/shared';
import {
  AgentReportingClient,
  AgentReportingConfigError,
  getAgentReportingConfig,
} from '../integrations/agent-reporting/agent-reporting.client';
import { PrismaService } from '../prisma/prisma.service';
import { YardOperationsService } from './yard-operations.service';
import { getShopWeekWindows } from './admin-time';
import {
  mapIncomingTrucks,
  mapUpcomingDepartures,
  mapWorkLocationItems,
  type ShopWeekWindows,
} from './yard-data-boundary';

@Injectable()
export class YardDataBoundaryService {
  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly yard?: YardOperationsService,
  ) {}

  async get(
    now = new Date(),
    fetchImpl: typeof fetch = fetch,
  ): Promise<YardDataBoundaryDto> {
    const asOf = now.toISOString();
    const windows = getShopWeekWindows(now);

    let reportingConfig;
    try {
      reportingConfig = getAgentReportingConfig(this.envSnapshot());
    } catch (error) {
      if (error instanceof AgentReportingConfigError) {
        return this.emptyBoundary(asOf, windows, 'error');
      }
      throw error;
    }

    if (!reportingConfig) {
      return this.emptyBoundary(asOf, windows, 'unavailable');
    }

    const client = new AgentReportingClient(reportingConfig, fetchImpl);
    const [workLocation, incomingTrucks, upcomingDepartures] = await Promise.all([
      this.loadWorkLocation(client),
      this.loadIncoming(client, windows),
      this.loadDepartures(client, windows),
    ]);

    const shop = await this.shopSide([workLocation, incomingTrucks, upcomingDepartures]);
    return { asOf, windows, workLocation, incomingTrucks, upcomingDepartures, ...(shop ? { shop } : {}) };
  }

  /**
   * Stage 6 (D8, UX-5-004): the shop's side of the Trucks Dispatch names — the Truck to link to, its
   * open Work Order and whether a Job sent the whole truck out (D24). One query for all of them;
   * Dispatch keeps working when this fails.
   */
  private async shopSide(
    sections: Array<{ status: string; items: Array<{ truckNumber: string }> }>,
  ): Promise<YardDispatchShopTruckDto[] | null> {
    if (!this.prisma) return null;
    const numbers = [...new Set(sections.filter((section) => section.status === 'ok').flatMap((section) => section.items.map((item) => item.truckNumber)))];
    if (!numbers.length) return [];
    try {
      const trucks = await this.prisma.truck.findMany({
        where: { truckNumber: { in: numbers } },
        select: {
          id: true,
          truckNumber: true,
          workOrders: {
            where: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
            select: { id: true, displayId: true, jobs: { where: { externalSince: { not: null }, externalKind: JobExternalKind.truck }, select: { id: true } } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      // Stage 8: the step, Ready to Go and Jobs left come from the Yard's own derivation (same as the board).
      const status = this.yard ? await this.yard.shopStatusByTruckNumber(trucks.map((truck) => truck.truckNumber)) : new Map();
      return trucks.map((truck) => {
        const open = truck.workOrders[0] ?? null;
        const shop = status.get(truck.truckNumber);
        return {
          truckNumber: truck.truckNumber,
          truckId: truck.id,
          openWorkOrder: open ? { id: open.id, displayId: open.displayId } : null,
          outOfShop: Boolean(open?.jobs.length),
          ...(shop ? { phase: shop.phase, readyToGo: shop.readyToGo, jobsLeft: shop.jobsLeft } : { phase: null, readyToGo: false, jobsLeft: 0 }),
        };
      });
    } catch {
      return null;
    }
  }

  private envSnapshot(): NodeJS.ProcessEnv {
    const timeout = this.config.get<string | number>('AGENT_REPORTING_TIMEOUT_MS');
    return {
      AGENT_REPORTING_KEY: this.config.get<string>('AGENT_REPORTING_KEY'),
      AGENT_REPORTING_URL: this.config.get<string>('AGENT_REPORTING_URL'),
      AGENT_REPORTING_TIMEOUT_MS: timeout == null ? undefined : String(timeout),
    };
  }

  private emptyBoundary(
    asOf: string,
    windows: ShopWeekWindows,
    status: 'unavailable' | 'error',
  ): YardDataBoundaryDto {
    const message = YARD_DATA_BOUNDARY_SECTION_MESSAGE;
    return {
      asOf,
      windows,
      workLocation: { status, items: [], message },
      incomingTrucks: { status, items: [], message },
      upcomingDepartures: { status, items: [], message },
    };
  }

  private async loadWorkLocation(client: AgentReportingClient): Promise<YardWorkLocationSectionDto> {
    try {
      const { rows } = await client.listAll('trucks');
      const mapped = mapWorkLocationItems(rows);
      return { status: 'ok', items: mapped.items, ...(mapped.summary ? { summary: mapped.summary } : {}) };
    } catch {
      return { status: 'error', items: [], message: YARD_DATA_BOUNDARY_SECTION_MESSAGE };
    }
  }

  private async loadIncoming(
    client: AgentReportingClient,
    windows: ShopWeekWindows,
  ): Promise<YardDataBoundarySectionDto<YardIncomingTruckItemDto>> {
    try {
      const { rows } = await client.listAll('returns');
      return { status: 'ok', items: mapIncomingTrucks(rows, windows) };
    } catch {
      return { status: 'error', items: [], message: YARD_DATA_BOUNDARY_SECTION_MESSAGE };
    }
  }

  private async loadDepartures(
    client: AgentReportingClient,
    windows: ShopWeekWindows,
  ): Promise<YardDataBoundarySectionDto<YardUpcomingDepartureItemDto>> {
    try {
      const { rows } = await client.listAll('driver_pay', {
        out_from: windows.thisWeek.from,
        out_to: windows.nextWeek.to,
      });
      return { status: 'ok', items: mapUpcomingDepartures(rows, windows) };
    } catch {
      return { status: 'error', items: [], message: YARD_DATA_BOUNDARY_SECTION_MESSAGE };
    }
  }
}
