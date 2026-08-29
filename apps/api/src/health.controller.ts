import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  root() {
    return {
      name: 'Lightning Shop API',
      ok: true,
      health: '/api/health',
      docs: {
        me: 'GET /api/auth/me',
        workOrders: 'GET /api/work-orders',
        trucks: 'GET /api/trucks',
      },
      web: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    };
  }

  @Get('health')
  health() {
    return {
      ok: true,
      dataSource: process.env.DATA_SOURCE ?? 'supabase',
      timestamp: new Date().toISOString(),
    };
  }
}
