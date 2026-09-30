import { Module } from '@nestjs/common';
import { EventStoreService } from './event-store.service';
import { EventsController } from './events.controller';

@Module({
  controllers: [EventsController],
  providers: [EventStoreService],
  exports: [EventStoreService]
})
export class EventsModule {}
