import { Controller, Get, Inject, Query, UseGuards, forwardRef } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { UsersService } from '../users/users.service';

@ApiTags('staff')
@ApiBearerAuth()
@Controller({ path: 'nurses', version: '1' })
export class NursesController {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role, 'recording' as Role)
  @Get()
  async list(@Query('department') department?: string) {
    const list = await this.usersService.findByAnyRole(['staff', 'nurse']);
    const filtered = department
      ? list.filter((u: any) => (u.department || '').toLowerCase() === department.toLowerCase())
      : list;
    return filtered.map((u: any) => {
      const obj = u.toObject ? u.toObject() : u;
      delete obj.passwordHash;
      delete obj.refreshTokenHash;
      return obj;
    });
  }
}
