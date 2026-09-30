import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { UsersService } from '../users/users.service';
import { Injectable } from '@nestjs/common';

@ApiTags('doctors')
@ApiBearerAuth()
@Controller({ path: 'doctors', version: '1' })
@Injectable()
export class DoctorsController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role, 'recording' as Role)
  @Get()
  async list(@Query('department') department?: string) {
    const list = await this.usersService.findByRole('doctor');
    const filtered = department
      ? list.filter((u: any) => (u.doctor?.hospital || u.department || '').toLowerCase() === department.toLowerCase())
      : list;
    return filtered.map((u: any) => {
      const obj = u.toObject ? u.toObject() : u;
      delete obj.passwordHash;
      delete obj.refreshTokenHash;
      return obj;
    });
  }
}
