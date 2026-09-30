import { forwardRef, Module } from '@nestjs/common';
import { DayListService } from './daylist.service';
import { DayListController } from './daylist.controller';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [DayListController, ReportController],
  providers: [DayListService, ReportService],
  exports: [DayListService, ReportService],
})
export class DoctorsModule {}
