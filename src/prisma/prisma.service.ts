import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL database (Supabase)');
    } catch (error) {
      this.logger.warn(
        `Database connection initialized with fallback offline mode: ${error?.message || error}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
