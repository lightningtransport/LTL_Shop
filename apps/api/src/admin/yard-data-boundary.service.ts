import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  YARD_DATA_BOUNDARY_SECTION_MESSAGE,
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
import { getShopWeekWindows } from './admin-time';
import {
  mapIncomingTrucks,
  mapUpcomingDepartures,
  mapWorkLocationItems,
  type ShopWeekWindows,
} from './yard-data-boundary';

@Injectable()
export class YardDataBoundaryService {
  constructor(private readonly config: ConfigService) {}

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

    return { asOf, windows, workLocation, incomingTrucks, upcomingDepartures };
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
