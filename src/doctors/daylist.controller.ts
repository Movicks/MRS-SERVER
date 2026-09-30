import { Body, Controller, Get, Post, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { DayListService } from './daylist.service';

@ApiTags('doctors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'doctors/daylist', version: '1' })
export class DayListController {
  constructor(private readonly svc: DayListService) {}

  @Roles('staff' as Role, 'super_admin' as Role)
  @Post()
  async add(@Body() body: { patientId: string; sourceDepartment?: string }) {
    return this.svc.add(body.patientId, undefined, body.sourceDepartment);
  }

  @Roles('doctor' as Role, 'super_admin' as Role)
  @Get()
  async listToday(
    @Query('sourceDepartment') sourceDepartment?: string,
    @Query('range') range?: 'today' | 'all',
    @Query('start') start?: string,
    @Query('end') end?: string
  ) {
    return this.svc.list(sourceDepartment, range, start, end);
  }
}
