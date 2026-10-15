/**
 * LTR-212 / PF14: how often a screen refreshes on its own. Every feed on the same
 * screen uses the same cadence, so they refresh together: one burst of requests per
 * tick instead of a request every few seconds (each one a chance to hit a cold API
 * start). Hidden tabs do not refresh (SWR default), and coming back to a tab
 * refreshes at most once per FOCUS_REFRESH_THROTTLE_MS.
 */
export const LIVE_REFRESH_MS = {
  /** A screen someone is working on right now: a Work Order (Admin or mechanic), the PM service. */
  workingOn: 15_000,
  /** Lists and boards: Dashboard, Yard, Work Orders, My work, team queue, To inspect, Safety queue. */
  board: 30_000,
  /** Side status that rarely changes: the Dispatch data badge on the Dashboard and the Yard. */
  status: 60_000,
} as const;

export const FOCUS_REFRESH_THROTTLE_MS = 15_000;
