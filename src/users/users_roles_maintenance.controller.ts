import { Controller, Inject, Post, UseGuards, forwardRef } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { UsersService } from './users.service';
import { DoctorProfileService } from '../doctor-profile/doctor-profile.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersRolesMaintenanceController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => DoctorProfileService))
    private readonly doctorProfileService: DoctorProfileService
  ) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('super_admin' as Role, 'admin' as Role)
    @Post('roles/normalize-doctors')
    async normalizeDoctors() {
      const withDoctor = await this.usersService.findByRole('doctor');
      let updated = 0;
      for (const u of withDoctor) {
        const uid = String((u as any).id || (u as any)._id);
        const roles = (u.roles || []).filter((r: string) => r !== 'doctor');
        await this.usersService.assignRoles(uid, roles);
        try {
          await this.doctorProfileService.createSkeleton(uid, u.email, u.name);
        } catch {
          /* ignore */
        }
        updated++;
      }
      return { ok: true, normalized: updated };
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('super_admin' as Role, 'admin' as Role)
    @Post('migrate/doctor-profiles-to-users')
    async migrateDoctorProfilesToUsers() {
      const profiles = await this.doctorProfileService.listAll();
      let migrated = 0;
      for (const p of profiles) {
        await this.usersService.upsertFromDoctorProfile(p);
        migrated++;
      }
      return { ok: true, migrated };
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('super_admin' as Role, 'admin' as Role)
    @Post('roles/remove-patient')
    async removePatientRoleFromAll() {
      const all = await this.usersService.findAll();
      let updated = 0;
      for (const u of all) {
        const uid = String((u as any).id || (u as any)._id);
        const roles = (u.roles || []).filter((r: string) => r !== 'patient');
        if (roles.length !== (u.roles || []).length) {
          await this.usersService.assignRoles(uid, roles);
          updated++;
        }
      }
      return { ok: true, updated };
    }
}
