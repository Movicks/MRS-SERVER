import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventStoreService } from '../../events/event-store.service';

@Injectable()
export class DutiesReplayService {
  constructor(
    private readonly events: EventStoreService,
    private readonly prisma: PrismaService
  ) {}

  async rebuildFromEvents() {
    await this.prisma.dutyRecord.deleteMany({});
    const stream = await this.events.scan({ aggregateType: 'DutyRecord' });
    for (const e of stream as any[]) {
      if (e.eventType === 'DutyCreated') {
        const duty = (e.payload || {}).duty;
        if (!duty?.id && !duty?._id) continue;
        const id = String(duty.id || duty._id);
        const { _id, ...dutyData } = duty;
        await this.prisma.dutyRecord.upsert({
          where: { id },
          create: { id, ...dutyData },
          update: dutyData
        });
      } else if (e.eventType === 'DutyUpdated') {
        const duty = (e.payload || {}).duty;
        if (!duty?.id && !duty?._id) continue;
        const id = String(duty.id || duty._id);
        const { _id, ...dutyData } = duty;
        await this.prisma.dutyRecord.upsert({
          where: { id },
          create: { id, ...dutyData },
          update: dutyData
        });
      } else if (e.eventType === 'DutyDeleted') {
        const id = String((e.payload || {}).dutyId || e.aggregateId || '');
        if (!id) continue;
        await this.prisma.dutyRecord.delete({ where: { id } }).catch(() => null);
      }
    }
    return { ok: true };
  }
}
