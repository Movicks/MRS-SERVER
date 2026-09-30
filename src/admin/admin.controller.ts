import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SignupGuard } from '../auth/guards/signup.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { CreateAdminDto } from './dto/create-admin.dto';

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiBearerAuth()
  @UseGuards(SignupGuard)
  @ApiOperation({ summary: 'Register a new Super Admin account', description: 'Creates the initial Super Admin if none exists, or requires Super Admin auth if one already exists.' })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({ status: 201, description: 'Super Admin created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request - Validation error.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Requires Super Admin token when a Super Admin already exists.' })
  @ApiResponse({ status: 409, description: 'Conflict - Email already registered.' })
  @Post('super-admin/signup')
  async signupSuperAdmin(@Body() dto: CreateAdminDto) {
    const admin = await this.adminService.create(dto);
    const obj = admin.toObject ? admin.toObject() : admin;
    const safe = { ...obj };
    delete safe.passwordHash;
    delete safe.refreshTokenHash;
    return safe;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @ApiOperation({ summary: 'Register a new Admin user account', description: 'Allows a Super Admin to create a new Admin user.' })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({ status: 201, description: 'Admin user created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request - Validation error.' })
  @ApiResponse({ status: 409, description: 'Conflict - Email already registered.' })
  @Post('signup')
  async signupAdmin(@Body() dto: CreateAdminDto) {
    const user = await this.adminService.createAdminUser(dto);
    const obj = user.toObject ? user.toObject() : user;
    const safe = { ...obj };
    delete safe.passwordHash;
    delete safe.refreshTokenHash;
    return safe;
  }
}
