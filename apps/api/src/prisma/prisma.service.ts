import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

function runtimeDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize Prisma.');
  }
  return databaseUrl;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: runtimeDatabaseUrl() }),
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async ensureConnected() {
    if (this.connected) return;
    await this.connectWithRetry();
  }

  private async connectWithRetry(retries = process.env.VERCEL ? 1 : 5) {
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
        if (i < retries) {
          await new Promise((r) => setTimeout(r, 1000 * i));
        }
      }
    }
    // Keep the HTTP process alive so health routes still respond on cold start.
    // Request handlers that need the DB will fail until reconnect succeeds.
    this.logger.error(
      `Database unavailable after ${retries} attempts. API is up; DB calls will fail until reconnect.${
        lastError instanceof Error ? ` Last error: ${lastError.message}` : ''
      }`,
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
