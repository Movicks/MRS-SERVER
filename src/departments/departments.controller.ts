import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { DepartmentsService } from './departments.service';
import { Patch, Delete, Param } from '@nestjs/common';

@ApiTags('departments')
@Controller({ path: 'departments', version: '1' })
export class DepartmentsController {
  constructor(private readonly svc: DepartmentsService) {}

  @Get()
  async list() {
    return this.svc.list();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role)
  @Post()
  async create(@Body() body: { name: string; description?: string }) {
    return this.svc.create(body.name, body.description);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { name?: string; description?: string; bedCapacity?: number }) {
    return this.svc.update(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.svc.remove(id);
    return { ok: true };
  }
}
