import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err: any) {
      this.logger.warn('Database connection failed on startup. Attempting automatic database creation & migration...');
      try {
        execSync('npx prisma db push', { stdio: 'inherit' });
        await this.$connect();
        this.logger.log('Database created and schema migrated successfully.');
      } catch (pushErr) {
        this.logger.error('Failed to automatically create or migrate database', pushErr);
        throw err;
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
