import { Module } from '@nestjs/common';
import { LabReferralsService } from './lab-referrals.service';
import { LabReferralsController } from './lab-referrals.controller';

@Module({
  controllers: [LabReferralsController],
  providers: [LabReferralsService],
  exports: [LabReferralsService],
})
export class LabReferralsModule {}
