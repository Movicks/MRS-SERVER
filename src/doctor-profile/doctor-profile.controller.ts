import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req, UseGuards, forwardRef } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { DoctorProfileService } from './doctor-profile.service';
import { DoctorProfile } from './doctor-profile.schema';
import { UsersService } from '../users/users.service';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

@ApiTags('doctor-profiles')
@Controller({ path: 'doctor-profiles', version: '1' })
export class DoctorProfileController {
  constructor(
    private readonly profileService: DoctorProfileService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role)
  @Get()
  async listAll() {
    const list = await this.profileService.listAll();
    return list.map((p) => p);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role)
  @Get(':userId')
  async getByUserId(@Param('userId') userId: string) {
    try {
      const profile = await this.profileService.findByUserId(userId);
      return profile;
    } catch {
      const user = await this.usersService.findById(userId);
      if (!user) return null;
      const u: any = user.toObject ? user.toObject() : user;
      return {
        userId: u.id || String(u._id || ''),
        personalInfo: {
          id: u.id || String(u._id || ''),
          fullName: u.name || '',
          dateOfBirth: '',
          gender: '',
          nationality: u.country || '',
          state: u.state || '',
          phone: u.phone || '',
          email: u.email || '',
          address: u.address || '',
          idDocument: '',
          emergencyContact: u.emergencyPhone || '',
          imageUrl: u.imageUrl || '',
          hospital: u.doctor?.hospital || '',
          status: u.doctor?.status || 'pending',
        },
        qualifications: {
          medicalDegree: u.doctor?.qualifications?.medicalDegree || '',
          specialization: u.doctor?.qualifications?.specialization || '',
          licenses: u.doctor?.qualifications?.licenses || '',
          boardCertifications: u.doctor?.qualifications?.boardCertifications || '',
          additionalCertifications: u.doctor?.qualifications?.additionalCertifications || '',
          medicalSchool: u.doctor?.qualifications?.medicalSchool || '',
          graduationYear: u.doctor?.qualifications?.graduationYear || '',
        },
        experience: { employers: '', jobTitles: '', responsibilities: '', references: '', specializedExperience: '' },
        cme: { workshops: '', research: '', fellowships: '' },
        skills: { clinicalSkills: '', surgicalExperience: '', equipment: '', leadership: '' },
        health: { medicalHistory: '', vaccinations: '', screenings: '' },
        legal: { licenseProof: '', backgroundCheck: '', insurance: '' },
        statement: { motivation: '', careerGoals: '', hospitalReason: '' },
        documents: { cv: '', photo: '', contract: '', availability: '' },
      } as any;
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: { userId: string } }) {
    try {
      const profile = await this.profileService.findByUserId(req.user.userId);
      return profile;
    } catch {
      const user = await this.usersService.findById(req.user.userId);
      if (!user) return null;
      const u: any = user.toObject ? user.toObject() : user;
      return {
        userId: u.id || String(u._id || ''),
        personalInfo: {
          id: u.id || String(u._id || ''),
          fullName: u.name || '',
          dateOfBirth: '',
          gender: '',
          nationality: u.country || '',
          state: u.state || '',
          phone: u.phone || '',
          email: u.email || '',
          address: u.address || '',
          idDocument: '',
          emergencyContact: u.emergencyPhone || '',
          imageUrl: u.imageUrl || '',
          hospital: u.doctor?.hospital || '',
          status: u.doctor?.status || 'pending',
        },
        qualifications: {
          medicalDegree: u.doctor?.qualifications?.medicalDegree || '',
          specialization: u.doctor?.qualifications?.specialization || '',
          licenses: u.doctor?.qualifications?.licenses || '',
          boardCertifications: u.doctor?.qualifications?.boardCertifications || '',
          additionalCertifications: u.doctor?.qualifications?.additionalCertifications || '',
          medicalSchool: u.doctor?.qualifications?.medicalSchool || '',
          graduationYear: u.doctor?.qualifications?.graduationYear || '',
        },
        experience: { employers: '', jobTitles: '', responsibilities: '', references: '', specializedExperience: '' },
        cme: { workshops: '', research: '', fellowships: '' },
        skills: { clinicalSkills: '', surgicalExperience: '', equipment: '', leadership: '' },
        health: { medicalHistory: '', vaccinations: '', screenings: '' },
        legal: { licenseProof: '', backgroundCheck: '', insurance: '' },
        statement: { motivation: '', careerGoals: '', hospitalReason: '' },
        documents: { cv: '', photo: '', contract: '', availability: '' },
      } as any;
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @Req() req: { user: { userId: string } },
    @Body() patch: DeepPartial<DoctorProfile>
  ) {
    const profile = await this.profileService.updateForUser(req.user.userId, patch);
    return profile;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/complete')
  async complete(@Req() req: { user: { userId: string } }) {
    const profile = await this.profileService.completeOnboarding(req.user.userId);
    return profile;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role)
  @Patch(':userId/status')
  async updateStatus(@Param('userId') userId: string, @Body() body: { status: string }) {
    const profile = await this.profileService.updateStatus(userId, body.status);
    return profile;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role)
  @Delete(':userId')
  async remove(@Param('userId') userId: string) {
    return this.profileService.deleteByUserId(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role)
  @Patch(':userId/reset-password')
  async resetPassword(@Param('userId') userId: string) {
    return this.profileService.resetPassword(userId);
  }
}
