import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { VitalsService } from './vitals.service';

@ApiTags('gopd')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'gopd/vitals', version: '1' })
export class VitalsController {
  constructor(private readonly svc: VitalsService) {}

  @Roles('staff' as Role, 'super_admin' as Role)
  @Post()
  async create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Roles('staff' as Role, 'doctor' as Role, 'super_admin' as Role)
  @Get()
  async list(@Query('patientId') patientId: string) {
    return this.svc.listForPatient(patientId);
  }
}
