import { DEMO_HOSTED } from '../dev-login';

/**
 * D39 (DP3): what the panel says when the demo data is used up or the server is down. On the laptop that is a
 * command to run; in the published demo the data resets every night and nobody has a terminal.
 */
export const DEMO_REBUILD = DEMO_HOSTED
  ? 'The demo data resets every night: come back tomorrow for a clean run.'
  : 'Rebuild the demo: npm run prisma:demo-local';

export const DEMO_SERVER_DOWN = DEMO_HOSTED
  ? 'The demo is not answering right now. Try again in a minute.'
  : 'The demo server is not answering. Start it from a terminal: npm run start:demo';
