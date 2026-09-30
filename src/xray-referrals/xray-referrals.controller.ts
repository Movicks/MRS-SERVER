import { Body, Controller, Get, Post, Put, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { XrayReferralsService } from './xray-referrals.service';
import { XrayReferralStatus } from './xray-referral.schema';

@ApiTags('radiology')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'radiology/referrals', version: '1' })
export class XrayReferralsController {
  constructor(private readonly svc: XrayReferralsService) {}

  @Roles('doctor' as Role, 'clinical' as Role)
  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const senderId = req?.user?.userId || req?.user?.sub;
    return this.svc.create({
      senderId,
      patientId: body.patientId,
      invoiceId: body.invoiceId,
      date: body.date,
      serviceNoOrUUID: body.serviceNoOrUUID,
      rank: body.rank,
      forenames: body.forenames,
      surname: body.surname,
      wardNo: body.wardNo,
      hospitalUnit: body.hospitalUnit,
      age: body.age,
      to: body.to,
      imagingArea: body.imagingArea,
      examinationRequired: body.examinationRequired,
      diagnosis: body.diagnosis,
      statement: body.statement,
      previousReportNos: body.previousReportNos,
      previousReportDate: body.previousReportDate,
    });
  }

  @Roles('doctor' as Role, 'radiology' as Role, 'staff' as Role, 'super_admin' as Role, 'admin' as Role)
  @Get()
  async list(
    @Query('status') status?: XrayReferralStatus,
    @Query('date') date?: string,
    @Query('patientId') patientId?: string,
    @Query('period') period?: 'daily' | 'monthly' | 'yearly',
    @Query('value') value?: string,
  ) {
    return this.svc.list({ status, date, patientId, period, value });
  }

  @Roles('radiology' as Role, 'staff' as Role, 'super_admin' as Role)
  @Put(':id/status')
  async setStatus(@Param('id') id: string, @Body() body: { status: XrayReferralStatus }) {
    return this.svc.setStatus(id, body.status);
  }

  @Roles('radiology' as Role, 'staff' as Role, 'super_admin' as Role)
  @Put(':id/results')
  async updateResults(@Param('id') id: string, @Body() body: { testResults: Record<string, string> }) {
    return this.svc.updateResults(id, { testResults: body.testResults || {} });
  }
}
