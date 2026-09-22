import { describe, expect, it } from 'vitest';
import { unavailableYardMovementFeeds } from './yard-movement-feeds';

describe('yard movement feeds', () => {
  it('keeps list movement cards unavailable until the data-boundary cutover', () => {
    const feeds = unavailableYardMovementFeeds();
    const unavailable = {
      status: 'unavailable',
      reason: 'integration_not_connected',
      items: [],
      total: 0,
    };

    expect(feeds.workLocation).toEqual(unavailable);
    expect(feeds.incomingTrucks).toEqual(unavailable);
    expect(feeds.upcomingDepartures).toEqual(unavailable);
    expect(feeds.workLocation.items).not.toBe(feeds.incomingTrucks.items);
    expect(feeds.incomingTrucks.items).not.toBe(feeds.upcomingDepartures.items);
  });
});
