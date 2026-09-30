import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { ClinicalDayListService } from './daylist.service';

@ApiTags('clinical')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'clinical/daylist', version: '1' })
export class ClinicalDayListController {
  constructor(private readonly svc: ClinicalDayListService) {}

  @Roles('staff' as Role, 'super_admin' as Role, 'admin' as Role)
  @Post()
  async add(@Body() body: { patientId: string; targetDepartment: 'EarDoctor' | 'EyeDoctor'; sourceDepartment?: string }) {
    return this.svc.add(body.patientId, body.targetDepartment, undefined, body.sourceDepartment);
  }

  @Roles('clinical' as Role, 'super_admin' as Role, 'admin' as Role)
  @Get()
  async list(
    @Query('targetDepartment') targetDepartment?: string,
    @Query('sourceDepartment') sourceDepartment?: string,
    @Query('range') range?: 'today' | 'all',
    @Query('start') start?: string,
    @Query('end') end?: string
  ) {
    return this.svc.list(targetDepartment, sourceDepartment, range, start, end);
  }
}

