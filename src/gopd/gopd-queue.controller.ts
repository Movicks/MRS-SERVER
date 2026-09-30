import { Controller, Get, Post, Body, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { GopdQueueService } from './gopd-queue.service';

@ApiTags('gopd')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'gopd/queue', version: '1' })
export class GopdQueueController {
  constructor(private readonly svc: GopdQueueService) {}

  @Roles('super_admin' as Role, 'staff' as Role)
  @Get()
  async list() {
    return this.svc.list();
  }

  @Roles('super_admin' as Role, 'recording' as Role)
  @Post()
  async add(@Body() body: any) {
    return this.svc.add(body.patientId);
  }

  @Roles('super_admin' as Role, 'staff' as Role)
  @Delete(':patientId')
  async remove(@Param('patientId') patientId: string) {
    await this.svc.remove(patientId);
    return { ok: true };
  }
}
