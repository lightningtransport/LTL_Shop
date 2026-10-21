import { Injectable, Optional } from '@nestjs/common';
import { JobExternalKind, WorkOrderStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import {
  OPEN_WORK_ORDER_STATUSES,
  YARD_DATA_BOUNDARY_SECTION_MESSAGE,
  truckPlace,
  type YardDispatchMissingTruckDto,
  type YardSamsaraPlacesDto,
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
import { normalizeTruckNumber } from '../integrations/samsara/samsara-pairing';
import { PrismaService } from '../prisma/prisma.service';
import { toTruckDto } from '../trucks/trucks.service';
import { YardOperationsService } from './yard-operations.service';
import { getShopWeekWindows } from './admin-time';
import {
  dispatchSaysYard,
  mapDispatchTruckLinks,
  mapIncomingTrucks,
  mapUpcomingDepartures,
  mapWorkLocationItems,
  type DispatchTruckLink,
  type ShopWeekWindows,
} from './yard-data-boundary';

const numberKey = (value: string) => normalizeTruckNumber(value);

type BoundaryTruck = {
  id: string;
  truckNumber: string;
  key: string | null;
  openWorkOrder: { id: string; displayId: string } | null;
  outOfShop: boolean;
  samsara: ReturnType<typeof toTruckDto>['samsara'] | null;
  deactivated: boolean;
};

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

    // D50: where our trucks are comes from our own table (Samsara, D49), with or without Dispatch.
    const trucks = await this.loadTrucks();

    let reportingConfig;
    try {
      reportingConfig = getAgentReportingConfig(this.envSnapshot());
    } catch (error) {
      if (error instanceof AgentReportingConfigError) {
        return this.withPlaces(this.emptyBoundary(asOf, windows, 'error'), trucks, new Map());
      }
      throw error;
    }

    if (!reportingConfig) {
      return this.withPlaces(this.emptyBoundary(asOf, windows, 'unavailable'), trucks, new Map());
    }

    const client = new AgentReportingClient(reportingConfig, fetchImpl);
    const [{ section: workLocation, links }, incomingTrucks, upcomingDepartures] = await Promise.all([
      this.loadWorkLocation(client),
      this.loadIncoming(client, windows),
      this.loadDepartures(client, windows),
    ]);

    const side = await this.shopSide([workLocation, incomingTrucks, upcomingDepartures], trucks, links);
    return this.withPlaces(
      { asOf, windows, workLocation, incomingTrucks, upcomingDepartures, ...(side ? { shop: side.shop, missing: side.missing } : {}) },
      trucks,
      links,
    );
  }

  /** Every active truck with its open Work Order and Samsara reading; null when the database is not reachable here. */
  private async loadTrucks(): Promise<BoundaryTruck[] | null> {
    if (!this.prisma) return null;
    try {
      // Deactivated trucks too: Dispatch may still name one, and it is not "missing" (it left the fleet on purpose, D44).
      const rows = await this.prisma.truck.findMany({
        include: {
          workOrders: {
            where: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
            select: { id: true, displayId: true, jobs: { where: { externalSince: { not: null }, externalKind: JobExternalKind.truck }, select: { id: true } } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      return rows.map((row) => {
        const open = row.workOrders[0] ?? null;
        return {
          id: row.id,
          truckNumber: row.truckNumber,
          key: numberKey(row.truckNumber),
          openWorkOrder: open ? { id: open.id, displayId: open.displayId } : null,
          outOfShop: Boolean(open?.jobs.length),
          samsara: toTruckDto(row).samsara ?? null,
          deactivated: Boolean(row.deactivatedAt),
        };
      });
    } catch {
      return null;
    }
  }

  /** D50: "Where trucks are · Samsara": In shop and In yard by D49, how many are outside, and where Dispatch says otherwise. */
  private withPlaces(boundary: YardDataBoundaryDto, trucks: BoundaryTruck[] | null, links: Map<string, DispatchTruckLink>): YardDataBoundaryDto {
    if (!trucks) return boundary;
    const places: YardSamsaraPlacesDto = { inShop: [], inYard: [], outside: 0, noGps: 0, dispatchDisagrees: [] };
    for (const truck of trucks) {
      if (truck.deactivated) continue;
      const place = truckPlace(truck.samsara, Boolean(truck.openWorkOrder));
      const dispatch = truck.key ? links.get(truck.key)?.location ?? null : null;
      const inYard = place !== null;
      const disagrees = Boolean(dispatch && truck.samsara?.locationAt && dispatchSaysYard(dispatch) !== inYard);
      if (disagrees) {
        places.dispatchDisagrees.push({ truckNumber: truck.truckNumber, truckId: truck.id, dispatch: dispatch!, samsara: inYard ? 'in_yard' : 'outside' });
      }
      if (place) {
        (place === 'in_shop' ? places.inShop : places.inYard).push({
          truckNumber: truck.truckNumber,
          truckId: truck.id,
          inYardSince: truck.samsara?.inYardSince ?? null,
          openWorkOrder: truck.openWorkOrder,
          dispatch: disagrees ? dispatch : null,
        });
      } else if (truck.samsara?.locationAt) {
        places.outside += 1;
      } else {
        places.noGps += 1;
      }
    }
    const byNumber = (a: { truckNumber: string }, b: { truckNumber: string }) => a.truckNumber.localeCompare(b.truckNumber, 'en', { numeric: true });
    places.inShop.sort(byNumber);
    places.inYard.sort(byNumber);
    places.dispatchDisagrees.sort(byNumber);
    return { ...boundary, samsaraPlaces: places };
  }

  /**
   * Stage 6 (D8, UX-5-004), D50: the shop's side of the Trucks Dispatch names — the Truck to link to, its open Work
   * Order, its step and its Samsara reading. Numbers match normalized ("0975" is 975). A number the Shop app does not
   * have goes to `missing`, with Dispatch's own Samsara link when it sends one. Dispatch keeps working when this fails.
   */
  private async shopSide(
    sections: Array<{ status: string; items: Array<{ truckNumber: string }> }>,
    trucks: BoundaryTruck[] | null,
    links: Map<string, DispatchTruckLink>,
  ): Promise<{ shop: YardDispatchShopTruckDto[]; missing: YardDispatchMissingTruckDto[] } | null> {
    if (!trucks) return null;
    const numbers = [...new Set(sections.filter((section) => section.status === 'ok').flatMap((section) => section.items.map((item) => item.truckNumber)))];
    // An active truck wins over a deactivated one with the same number.
    const byKey = new Map<string, BoundaryTruck>();
    for (const truck of trucks) {
      if (truck.key && (!byKey.has(truck.key) || byKey.get(truck.key)!.deactivated)) byKey.set(truck.key, truck);
    }
    const matched = numbers.map((number) => ({ number, truck: byKey.get(numberKey(number) ?? '') ?? null }));
    try {
      // Stage 8: the step, Ready to Go and Jobs left come from the Yard's own derivation (same as the board).
      const found = matched.filter((row) => row.truck).map((row) => row.truck!.truckNumber);
      const status = this.yard ? await this.yard.shopStatusByTruckNumber([...new Set(found)]) : new Map();
      const shop: YardDispatchShopTruckDto[] = [];
      const missing: YardDispatchMissingTruckDto[] = [];
      for (const { number, truck } of matched) {
        if (!truck) {
          const key = numberKey(number);
          missing.push({ truckNumber: number, samsaraVehicleId: (key && links.get(key)?.samsaraVehicleId) || null });
          continue;
        }
        const step = status.get(truck.truckNumber);
        shop.push({
          truckNumber: number,
          truckId: truck.id,
          openWorkOrder: truck.openWorkOrder,
          outOfShop: truck.outOfShop,
          ...(step ? { phase: step.phase, readyToGo: step.readyToGo, jobsLeft: step.jobsLeft, yardMove: step.yardMove } : { phase: null, readyToGo: false, jobsLeft: 0, yardMove: null }),
          samsara: truck.samsara,
        });
      }
      return { shop, missing };
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

  private async loadWorkLocation(client: AgentReportingClient): Promise<{ section: YardWorkLocationSectionDto; links: Map<string, DispatchTruckLink> }> {
    try {
      const { rows } = await client.listAll('trucks');
      const mapped = mapWorkLocationItems(rows);
      return {
        section: { status: 'ok', items: mapped.items, ...(mapped.summary ? { summary: mapped.summary } : {}) },
        links: mapDispatchTruckLinks(rows, numberKey),
      };
    } catch {
      return { section: { status: 'error', items: [], message: YARD_DATA_BOUNDARY_SECTION_MESSAGE }, links: new Map() };
    }
  }

  private async loadIncoming(
    client: AgentReportingClient,
    windows: ShopWeekWindows,
  ): Promise<YardDataBoundarySectionDto<YardIncomingTruckItemDto>> {
    try {
      // LTR-254: assignments still out on Monday of this shop week; the mapper keeps each Truck's latest.
      const { rows } = await client.listAll('driver_pay', { return_from: windows.thisWeek.from });
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
