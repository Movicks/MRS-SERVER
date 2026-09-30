import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { WardAdmissionStatus, type WardMedicationOrder } from './ward-admission.schema';
import { WardsService } from './wards.service';

@ApiTags('wards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'wards', version: '1' })
export class WardsController {
  constructor(private readonly svc: WardsService) {}

  @Roles('super_admin' as Role, 'admin' as Role, 'pharmacy' as Role, 'staff' as Role, 'doctor' as Role, 'recording' as Role)
  @Get('admissions')
  async list(
    @Query('wardUnit') wardUnit?: string,
    @Query('status') status?: WardAdmissionStatus | 'all',
  ) {
    return this.svc.list({ wardUnit, status: (status as any) || 'all' });
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'pharmacy' as Role, 'recording' as Role, 'staff' as Role)
  @Post('admissions')
  async admit(
    @Req() req: any,
    @Body()
    body: {
      patientId: string;
      wardUnit: string;
      bedPriceItemId: string;
      quantity?: number;
      pharmacyPrescription?: string;
      medicationOrders?: WardMedicationOrder[];
    },
  ) {
    const meta = { userId: req?.user?.sub as string, roles: (req?.user?.roles || []) as string[] };
    return this.svc.admit(body, meta);
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'pharmacy' as Role, 'recording' as Role, 'staff' as Role)
  @Patch('admissions/:id/discharge')
  async discharge(@Req() req: any, @Param('id') id: string) {
    const meta = { userId: req?.user?.sub as string, roles: (req?.user?.roles || []) as string[] };
    return this.svc.discharge(id, meta);
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'pharmacy' as Role, 'recording' as Role, 'staff' as Role)
  @Post('admissions/:id/medications/administer')
  async administer(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { drugPriceItemId: string; scheduledAt: string },
  ) {
    const meta = { userId: req?.user?.sub as string, roles: (req?.user?.roles || []) as string[] };
    return this.svc.administerMedication(id, body, meta);
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'pharmacy' as Role, 'recording' as Role, 'staff' as Role, 'doctor' as Role)
  @Patch('admissions/:id/medications')
  async updateMedications(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { pharmacyPrescription?: string; medicationOrders?: WardMedicationOrder[] },
  ) {
    const meta = { userId: req?.user?.sub as string, roles: (req?.user?.roles || []) as string[] };
    return this.svc.updateMedicationOrders(id, body, meta);
  }
}
