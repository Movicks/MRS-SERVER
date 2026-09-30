import { Module } from '@nestjs/common';
import { XrayReferralsService } from './xray-referrals.service';
import { XrayReferralsController } from './xray-referrals.controller';

@Module({
  controllers: [XrayReferralsController],
  providers: [XrayReferralsService],
  exports: [XrayReferralsService],
})
export class XrayReferralsModule {}
