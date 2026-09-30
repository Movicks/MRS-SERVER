import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PasswordService } from '../common/security/password';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly rt: RealtimeGateway
  ) {}

  async create(dto: CreateUserDto): Promise<any> {
    const email = dto.email.trim().toLowerCase();
    const existsUser = await this.prisma.user.findUnique({ where: { email } });
    if (existsUser) throw new ConflictException('Email already registered');
    const existsAdmin = await this.prisma.admin.findUnique({ where: { email } });
    if (existsAdmin) throw new ConflictException('Email already registered');
    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        passwordHash,
        department: (dto as any).department
      }
    });
    this.rt.emit('user.updated', { id: user.id });
    return user;
  }

  async anyUserExists(): Promise<boolean> {
    const count = await this.prisma.user.count();
    return count > 0;
  }

  async superAdminExists(): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { roles: { has: 'super_admin' } }
    });
    return !!user;
  }

  async findByEmail(email: string): Promise<any | null> {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });
  }

  async findByRole(role: string): Promise<any[]> {
    return this.prisma.user.findMany({
      where: { roles: { has: role } }
    });
  }

  async findByAnyRole(roles: string[]): Promise<any[]> {
    const list = Array.isArray(roles) ? roles.map((r) => String(r).trim()).filter(Boolean) : [];
    if (list.length === 0) return [];
    return this.prisma.user.findMany({
      where: { roles: { hasSome: list } }
    });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.user.findMany();
  }

  async findById(id: string): Promise<any | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<any> {
    const exists = await this.prisma.user.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('User not found');

    const data: any = { ...dto };
    if (data.email) data.email = data.email.trim().toLowerCase();

    const user = await this.prisma.user.update({
      where: { id },
      data
    });
    this.rt.emit('user.updated', { id: user.id });
    return user;
  }

  async assignRoles(id: string, roles: string[]): Promise<any> {
    const unique = Array.from(new Set(roles));
    const exists = await this.prisma.user.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('User not found');

    const user = await this.prisma.user.update({
      where: { id },
      data: { roles: unique }
    });
    this.rt.emit('user.updated', { id: user.id, roles });
    return user;
  }

  async validatePassword(user: any, plain: string): Promise<boolean> {
    return this.passwordService.verify(plain, user.passwordHash);
  }

  async suspend(id: string, suspended: boolean): Promise<any> {
    const exists = await this.prisma.user.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('User not found');

    const user = await this.prisma.user.update({
      where: { id },
      data: { suspended }
    });
    this.rt.emit('user.updated', { id: user.id, suspended });
    return user;
  }

  async remove(id: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('User not found');

    await this.prisma.user.delete({ where: { id } });
    this.rt.emit('user.deleted', { id });
  }

  async setRefreshToken(userId: string, tokenHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: tokenHash }
    });
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null }
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const ok = await this.passwordService.verify(currentPassword, user.passwordHash);
    if (!ok) throw new NotFoundException('Invalid current password');
    const hash = await this.passwordService.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hash,
        passwordVersion: (user.passwordVersion ?? 1) + 1,
        refreshTokenHash: null
      }
    });
  }

  async updateDoctorStatus(userId: string, status: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const doctorMeta: any = user.doctor || {};
    doctorMeta.status = status;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { doctor: doctorMeta }
    });
    this.rt.emit('user.updated', { id: updated.id, status });
    return updated;
  }

  async resetPassword(userId: string): Promise<{ password: string }> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&';
    const len = 14;
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const hash = await this.passwordService.hash(out);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hash,
        passwordVersion: (user.passwordVersion ?? 1) + 1,
        refreshTokenHash: null
      }
    });
    return { password: out };
  }

  async upsertFromDoctorProfile(profile: any): Promise<any> {
    const email = (profile?.personalInfo?.email || '').trim().toLowerCase();
    if (!email) throw new NotFoundException('Doctor email missing');
    let user = await this.prisma.user.findUnique({ where: { email } });
    const base = {
      email,
      name: profile?.personalInfo?.fullName || '',
      imageUrl: profile?.personalInfo?.imageUrl || '',
      phone: profile?.personalInfo?.phone || '',
      address: profile?.personalInfo?.address || '',
      country: profile?.personalInfo?.nationality || '',
      state: profile?.personalInfo?.state || '',
      emergencyPhone: profile?.personalInfo?.emergencyContact || '',
    };
    const doctorMeta: any = {
      status: profile?.personalInfo?.status || 'pending',
      hospital: profile?.personalInfo?.hospital || '',
      qualifications: {
        medicalDegree: profile?.qualifications?.medicalDegree || '',
        specialization: profile?.qualifications?.specialization || '',
        licenses: profile?.qualifications?.licenses || '',
        boardCertifications: profile?.qualifications?.boardCertifications || '',
        additionalCertifications: profile?.qualifications?.additionalCertifications || '',
        medicalSchool: profile?.qualifications?.medicalSchool || '',
        graduationYear: profile?.qualifications?.graduationYear || '',
      },
    };
    if (user) {
      const roles = new Set(user.roles || []);
      roles.add('doctor');
      const updatedData: any = {
        ...base,
        roles: Array.from(roles),
        doctor: doctorMeta,
      };
      if (profile?.passwordHash) {
        updatedData.passwordHash = profile.passwordHash;
        updatedData.passwordVersion = profile.passwordVersion ?? user.passwordVersion ?? 1;
      }
      if (profile?.refreshTokenHash) {
        updatedData.refreshTokenHash = profile.refreshTokenHash;
      }
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: updatedData
      });
      this.rt.emit('user.updated', { id: updated.id });
      return updated;
    }
    const newUser = await this.prisma.user.create({
      data: {
        ...base,
        roles: ['doctor'],
        passwordHash: profile?.passwordHash ?? (await this.passwordService.hash('TempPass#12345')),
        passwordVersion: profile?.passwordVersion ?? 1,
        refreshTokenHash: profile?.refreshTokenHash,
        doctor: doctorMeta,
      }
    });
    this.rt.emit('user.updated', { id: newUser.id });
    return newUser;
  }
}
