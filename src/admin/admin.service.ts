import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../common/security/password';
import { UpdateUserDto } from '../users/dto/update-user.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService
  ) {}

  async create(dto: { name: string; email: string; password: string }): Promise<any> {
    const email = dto.email.trim().toLowerCase();
    const existsAdmin = await this.prisma.admin.findUnique({ where: { email } });
    if (existsAdmin) throw new ConflictException('Email already registered');
    const existsUser = await this.prisma.user.findUnique({ where: { email } });
    if (existsUser) throw new ConflictException('Email already registered');
    const passwordHash = await this.passwordService.hash(dto.password);
    return this.prisma.admin.create({
      data: {
        email,
        name: dto.name,
        passwordHash,
        roles: ['super_admin']
      }
    });
  }

  async createAdminUser(dto: { name: string; email: string; password: string }): Promise<any> {
    const email = dto.email.trim().toLowerCase();
    const existsAdmin = await this.prisma.admin.findUnique({ where: { email } });
    if (existsAdmin) throw new ConflictException('Email already registered');
    const existsUser = await this.prisma.user.findUnique({ where: { email } });
    if (existsUser) throw new ConflictException('Email already registered');
    const passwordHash = await this.passwordService.hash(dto.password);
    return this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        passwordHash,
        roles: ['admin']
      }
    });
  }

  async adminExists(): Promise<boolean> {
    const count = await this.prisma.admin.count();
    return count > 0;
  }

  async findByEmail(email: string): Promise<any | null> {
    return this.prisma.admin.findUnique({ where: { email: email.trim().toLowerCase() } });
  }

  async findById(id: string): Promise<any | null> {
    return this.prisma.admin.findUnique({ where: { id } });
  }

  async validatePassword(admin: any, plain: string): Promise<boolean> {
    return this.passwordService.verify(plain, admin.passwordHash);
  }

  async setRefreshToken(adminId: string, tokenHash: string): Promise<void> {
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { refreshTokenHash: tokenHash }
    });
  }

  async clearRefreshToken(adminId: string): Promise<void> {
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { refreshTokenHash: null }
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<any> {
    const exists = await this.prisma.admin.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Admin not found');
    return this.prisma.admin.update({
      where: { id },
      data: dto as any
    });
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string): Promise<void> {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');
    const ok = await this.passwordService.verify(currentPassword, admin.passwordHash);
    if (!ok) throw new NotFoundException('Invalid current password');
    const hash = await this.passwordService.hash(newPassword);
    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        passwordHash: hash,
        passwordVersion: (admin.passwordVersion ?? 1) + 1,
        refreshTokenHash: null
      }
    });
  }
}
