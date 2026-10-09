import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { TeamQueueService } from './team-queue.service';

/** LTR-197 / D28: the mechanic's team queue — Jobs of their Shop workflow steps that nobody took yet. */
@Controller('team-queue')
@UseGuards(AuthGuard)
export class TeamQueueController {
  constructor(private readonly teamQueue: TeamQueueService) {}

  @Get()
  list(@Req() req: Request) {
    return this.teamQueue.list(req.user!);
  }

  @Post(':jobId/take')
  take(@Req() req: Request, @Param('jobId') jobId: string) {
    return this.teamQueue.take(req.user!, jobId);
  }

  @Post(':jobId/release')
  release(@Req() req: Request, @Param('jobId') jobId: string) {
    return this.teamQueue.release(req.user!, jobId);
  }
}
