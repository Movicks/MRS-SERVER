import { Module } from '@nestjs/common';
import { GopdQueueService } from './gopd-queue.service';
import { GopdQueueController } from './gopd-queue.controller';
import { VitalsService } from './vitals.service';
import { VitalsController } from './vitals.controller';

@Module({
  controllers: [GopdQueueController, VitalsController],
  providers: [GopdQueueService, VitalsService],
  exports: [GopdQueueService, VitalsService]
})
export class GopdModule {}
