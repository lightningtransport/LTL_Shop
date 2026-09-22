import type { YardFeedDto } from '@ltl-shop/shared';

/**
 * Board-list movement cards keep the `YardFeedDto` shape and stay unavailable
 * until Frontend mounts the LTR-70 cards (`GET /api/admin/yard/data-boundary`).
 * This list must not read agent-reporting. Schedule_Teams is out of scope.
 */
export function unavailableYardMovementFeeds(): {
  workLocation: YardFeedDto;
  incomingTrucks: YardFeedDto;
  upcomingDepartures: YardFeedDto;
} {
  return {
    workLocation: unavailableFeed(),
    incomingTrucks: unavailableFeed(),
    upcomingDepartures: unavailableFeed(),
  };
}

function unavailableFeed(): YardFeedDto {
  return {
    status: 'unavailable',
    reason: 'integration_not_connected',
    items: [],
    total: 0,
  };
}
