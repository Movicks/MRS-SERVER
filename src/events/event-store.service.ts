import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AppendEventInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  occurredAt?: Date;
  version?: number;
  payload: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

@Injectable()
export class EventStoreService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextSeq(): Promise<number> {
    const seqDoc = await this.prisma.eventSequence.upsert({
      where: { name: 'event_store' },
      create: { name: 'event_store', value: 1 },
      update: { value: { increment: 1 } }
    });
    return seqDoc.value;
  }

  async append(input: AppendEventInput) {
    const seq = await this.nextSeq();
    return this.prisma.eventRecord.create({
      data: {
        seq,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        version: input.version,
        occurredAt: input.occurredAt ?? new Date(),
        payload: input.payload as any || {},
        meta: input.meta as any || {}
      }
    });
  }

  async list(filters?: {
    aggregateType?: string;
    aggregateId?: string;
    eventType?: string;
    from?: string;
    to?: string;
    limit?: number;
    skip?: number;
  }) {
    const q: any = {};
    if (filters?.aggregateType) q.aggregateType = String(filters.aggregateType).trim();
    if (filters?.aggregateId) q.aggregateId = String(filters.aggregateId).trim();
    if (filters?.eventType) q.eventType = String(filters.eventType).trim();
    if (filters?.from || filters?.to) {
      const range: any = {};
      if (filters.from) range.gte = new Date(filters.from);
      if (filters.to) range.lte = new Date(filters.to);
      q.occurredAt = range;
    }
    const limit = Math.min(Math.max(Number(filters?.limit || 50), 1), 500);
    const skip = Math.max(Number(filters?.skip || 0), 0);
    return this.prisma.eventRecord.findMany({
      where: q,
      orderBy: { occurredAt: 'desc' },
      skip,
      take: limit
    });
  }

  async scan(filters?: { aggregateType?: string; eventType?: string }) {
    const q: any = {};
    if (filters?.aggregateType) q.aggregateType = String(filters.aggregateType).trim();
    if (filters?.eventType) q.eventType = String(filters.eventType).trim();
    return this.prisma.eventRecord.findMany({
      where: q,
      orderBy: { seq: 'asc' }
    });
  }
}
