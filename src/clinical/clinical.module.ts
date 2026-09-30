import { Module } from '@nestjs/common';
import { ClinicalDayListService } from './daylist.service';
import { ClinicalDayListController } from './daylist.controller';

@Module({
  controllers: [ClinicalDayListController],
  providers: [ClinicalDayListService],
  exports: [ClinicalDayListService],
})
export class ClinicalModule {}
