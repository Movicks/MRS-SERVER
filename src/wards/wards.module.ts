import { Module } from '@nestjs/common';
import { WardsService } from './wards.service';
import { WardsController } from './wards.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { PriceListModule } from '../price-list/price-list.module';

@Module({
  imports: [RealtimeModule, PriceListModule],
  controllers: [WardsController],
  providers: [WardsService],
  exports: [WardsService],
})
export class WardsModule {}
