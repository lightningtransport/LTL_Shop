import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async ensureConnected() {
    if (this.connected) return;
    await this.connectWithRetry();
  }

  private async connectWithRetry(retries = 5) {
    let lastError: unknown;
    for (let i = 1; i <= retries; i++) {
      try {
        await this.$connect();
        this.connected = true;
        this.logger.log('Database connected');
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Database connect attempt ${i}/${retries} failed; retrying...`,
        );
        await new Promise((r) => setTimeout(r, 1000 * i));
      }
    }
    // Don't crash the HTTP server in local/dev if DB is briefly unreachable.
    this.logger.error(
      `Database unavailable after ${retries} attempts. API is up; DB calls will fail until reconnect.`,
    );
    if (process.env.NODE_ENV === 'production') {
      throw lastError;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
