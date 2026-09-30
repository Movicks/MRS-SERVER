import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PasswordService } from '../common/security/password';
import { randomBytes } from 'crypto';

@Injectable()
export class DoctorProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rt: RealtimeGateway,
    private readonly passwordService: PasswordService
  ) {}

  async createSkeleton(userId: string, email: string, name?: string): Promise<any> {
    const existing = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.doctorProfile.create({
      data: {
        userId,
        personalInfo: {
          id: userId,
          fullName: name ?? '',
          email: (email || '').trim().toLowerCase(),
          status: 'pending'
        }
      }
    });
  }

  async listAll(): Promise<any[]> {
    return this.prisma.doctorProfile.findMany();
  }

  async findByEmail(email: string): Promise<any | null> {
    const e = (email || '').trim().toLowerCase();
    return this.prisma.doctorProfile.findFirst({
      where: {
        personalInfo: {
          path: ['email'],
          equals: e
        }
      }
    });
  }

  async createWithAuth(name: string, email: string, password: string): Promise<any> {
    const userId = randomBytes(12).toString('hex');
    const hash = await this.passwordService.hash(password);
    const profile = await this.prisma.doctorProfile.create({
      data: {
        userId,
        passwordHash: hash,
        passwordVersion: 1,
        personalInfo: {
          id: userId,
          fullName: name ?? '',
          email: (email || '').trim().toLowerCase(),
          status: 'pending'
        }
      }
    });
    this.rt.emit('profile.updated', { userId });
    return profile;
  }

  async validatePassword(profile: any, plain: string): Promise<boolean> {
    if (!profile.passwordHash) return false;
    return this.passwordService.verify(plain, profile.passwordHash);
  }

  async setRefreshToken(userId: string, tokenHash: string): Promise<void> {
    await this.prisma.doctorProfile.update({
      where: { userId },
      data: { refreshTokenHash: tokenHash }
    });
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.prisma.doctorProfile.update({
      where: { userId },
      data: { refreshTokenHash: null }
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    const ok = await this.validatePassword(profile, currentPassword);
    if (!ok) throw new NotFoundException('Invalid current password');
    const hash = await this.passwordService.hash(newPassword);
    await this.prisma.doctorProfile.update({
      where: { userId },
      data: {
        passwordHash: hash,
        passwordVersion: (profile.passwordVersion ?? 1) + 1,
        refreshTokenHash: null
      }
    });
  }

  async resetPassword(userId: string): Promise<{ password: string }> {
    const pass = this.generateRandomPassword();
    const hash = await this.passwordService.hash(pass);
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    await this.prisma.doctorProfile.update({
      where: { userId },
      data: {
        passwordHash: hash,
        passwordVersion: (profile.passwordVersion ?? 1) + 1,
        refreshTokenHash: null
      }
    });
    return { password: pass };
  }

  private generateRandomPassword(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&';
    const len = 14;
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  }

  async findByUserId(userId: string): Promise<any> {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async updateForUser(userId: string, patch: Record<string, any>): Promise<any> {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    return this.prisma.doctorProfile.update({
      where: { userId },
      data: patch as any
    });
  }

  async completeOnboarding(userId: string): Promise<any> {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    const personalInfo: any = profile.personalInfo || {};
    personalInfo.status = 'active';
    const updated = await this.prisma.doctorProfile.update({
      where: { userId },
      data: { personalInfo }
    });
    this.rt.emit('profile.updated', { userId });
    return updated;
  }

  async updateStatus(userId: string, status: string): Promise<any> {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    const personalInfo: any = profile.personalInfo || {};
    personalInfo.status = status;
    const updated = await this.prisma.doctorProfile.update({
      where: { userId },
      data: { personalInfo }
    });
    this.rt.emit('profile.updated', { userId, status });
    return updated;
  }

  async deleteByUserId(userId: string): Promise<{ ok: true }> {
    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    await this.prisma.doctorProfile.delete({ where: { userId } });
    this.rt.emit('profile.deleted', { userId });
    return { ok: true };
  }
}
