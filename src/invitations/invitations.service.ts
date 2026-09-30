import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppMailerService } from '../mailer/app-mailer.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { DoctorProfileService } from '../doctor-profile/doctor-profile.service';
import { randomBytes } from 'crypto';

export function generateInvitationToken() {
  return randomBytes(16).toString('hex');
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: AppMailerService,
    private readonly usersService: UsersService,
    private readonly doctorProfileService: DoctorProfileService,
    private readonly rt: RealtimeGateway
  ) {}

  async inviteDoctor(email: string, invitedBy?: string): Promise<any> {
    const existingPending = await this.prisma.invitation.findFirst({
      where: { email: email.trim().toLowerCase(), role: 'doctor', status: 'pending' }
    });
    if (existingPending) {
      this.logger.log(`Resending invitation to existing pending invite for ${email}`);
      const res = await this.mailer.sendInvitation(email, existingPending.token, 'Doctor');
      if (!res.ok) throw new ServiceUnavailableException(res.error || 'Failed to send invitation email');
      this.rt.emitToRole('super_admin', 'invitation.resend', { email, role: 'doctor' });
      return existingPending;
    }

    const token = generateInvitationToken();
    const res = await this.mailer.sendInvitation(email, token, 'Doctor');
    if (!res.ok) throw new ServiceUnavailableException(res.error || 'Failed to send invitation email');
    const saved = await this.prisma.invitation.create({
      data: {
        email: email.trim().toLowerCase(),
        role: 'doctor',
        token,
        status: 'pending',
        invitedBy
      }
    });
    this.logger.log(`Invitation record created for ${email} (token: ${token.slice(0, 8)}...)`);
    this.rt.emitToRole('super_admin', 'invitation.created', { email, role: 'doctor' });

    return saved;
  }

  async inviteNurse(email: string, invitedBy?: string): Promise<any> {
    return this.inviteStaff(email, invitedBy);
  }

  async inviteStaff(email: string, invitedBy?: string): Promise<any> {
    const existingPending = await this.prisma.invitation.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        role: { in: ['staff', 'nurse'] },
        status: 'pending'
      }
    });
    if (existingPending) {
      this.logger.log(`Resending invitation to existing pending staff invite for ${email}`);
      const res = await this.mailer.sendInvitation(email, existingPending.token, 'Staff');
      if (!res.ok) throw new ServiceUnavailableException(res.error || 'Failed to send invitation email');
      this.rt.emitToRole('super_admin', 'invitation.resend', { email, role: 'staff' });
      return existingPending;
    }
    const token = generateInvitationToken();
    const res = await this.mailer.sendInvitation(email, token, 'Staff');
    if (!res.ok) throw new ServiceUnavailableException(res.error || 'Failed to send invitation email');
    const saved = await this.prisma.invitation.create({
      data: {
        email: email.trim().toLowerCase(),
        role: 'staff',
        token,
        status: 'pending',
        invitedBy
      }
    });
    this.logger.log(`Staff invitation record created for ${email} (token: ${token.slice(0, 8)}...)`);
    this.rt.emitToRole('super_admin', 'invitation.created', { email, role: 'staff' });
    return saved;
  }

  async findByToken(token: string): Promise<any | null> {
    return this.prisma.invitation.findUnique({ where: { token } });
  }

  async findPendingByEmail(email: string): Promise<any | null> {
    return this.prisma.invitation.findFirst({
      where: { email: email.trim().toLowerCase(), role: 'doctor', status: 'pending' }
    });
  }

  async createDoctorDirect(name: string, email: string) {
    const password = this.generateRandomPassword();
    const user = await this.usersService.create({ name, email, password } as any);
    await this.usersService.assignRoles(user.id, [...(user.roles || []), 'doctor']);
    return { id: user.id, email: user.email, name: user.name, password };
  }

  async createNurseDirect(name: string, email: string, department?: string) {
    return this.createStaffDirect(name, email, department);
  }

  async createStaffDirect(name: string, email: string, department?: string) {
    const password = this.generateRandomPassword();
    const user = await this.usersService.create({ name, email, password, department });
    await this.usersService.assignRoles(user.id, ['staff']);
    return { id: user.id, email: user.email, name: user.name, password };
  }

  async createRecordingDirect(name: string, email: string) {
    const password = this.generateRandomPassword();
    const user = await this.usersService.create({ name, email, password } as any);
    await this.usersService.assignRoles(user.id, ['recording']);
    return { id: user.id, email: user.email, name: user.name, password };
  }

  async createRadiologyDirect(name: string, email: string) {
    const password = this.generateRandomPassword();
    const user = await this.usersService.create({ name, email, password } as any);
    await this.usersService.assignRoles(user.id, ['radiology']);
    return { id: user.id, email: user.email, name: user.name, password };
  }

  async createClinicalDirect(name: string, email: string, department: string) {
    const deptRaw = String(department || '').trim();
    if (!deptRaw) throw new BadRequestException('department is required');
    const dept = deptRaw.toLowerCase() === 'eardoctor' ? 'EarDoctor' : deptRaw.toLowerCase() === 'eyedoctor' ? 'EyeDoctor' : '';
    if (!dept) throw new BadRequestException('department must be EarDoctor or EyeDoctor');
    const password = this.generateRandomPassword();
    const user = await this.usersService.create({ name, email, password, department: dept } as any);
    await this.usersService.assignRoles(user.id, ['clinical']);
    return { id: user.id, email: user.email, name: user.name, password };
  }

  private generateRandomPassword(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&';
    const len = 14;
    let out = '';
    for (let i = 0; i < len; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  }

  async markAcceptedByEmail(email: string): Promise<void> {
    const inv = await this.prisma.invitation.findFirst({
      where: { email: email.trim().toLowerCase(), role: 'doctor', status: 'pending' }
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    await this.prisma.invitation.update({
      where: { id: inv.id },
      data: { status: 'accepted', acceptedAt: new Date() }
    });
  }

  async acceptByToken(token: string, email: string, password: string, name?: string) {
    const inv = await this.prisma.invitation.findUnique({ where: { token } });
    if (!inv || inv.status !== 'pending') throw new NotFoundException('Invitation not found or already processed');
    if (inv.email.toLowerCase() !== email.toLowerCase()) {
      throw new BadRequestException('Email does not match this invitation');
    }
    const role = inv.role || 'doctor';
    const patch: any = { name: name || inv.email.split('@')[0], email: inv.email, password };
    if (role === 'staff') patch.department = 'GOPD';
    const user = await this.usersService.create(patch);
    await this.usersService.assignRoles(user.id, [...(user.roles || []), role]);
    await this.prisma.invitation.update({
      where: { id: inv.id },
      data: { status: 'accepted', acceptedAt: new Date() }
    });
    if (role === 'doctor') await this.mailer.sendDoctorWelcome(user.email, user.name);
    this.rt.emitToRole('super_admin', 'invitation.accepted', { email: user.email, role });
    return { ok: true };
  }
}
