import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AdminService } from '../admin/admin.service';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from '../common/security/password';
import { RegisterDto } from './dto/register.dto';
import { InvitationsService } from '../invitations/invitations.service';
import { DoctorProfileService } from '../doctor-profile/doctor-profile.service';
import { DutiesService } from '../duties/duties.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly adminService: AdminService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly invitationsService: InvitationsService,
    private readonly doctorProfileService: DoctorProfileService,
    private readonly dutiesService: DutiesService
  ) {}

  async register(dto: RegisterDto) {
    const hasAdmin = await this.adminService.adminExists();
    // If no admin exists, first registration becomes super admin
    if (!hasAdmin) {
      const admin = await this.adminService.create(dto);
      const adminObj = admin.toObject();
      const safeAdmin: Record<string, unknown> = { ...adminObj };
      delete (safeAdmin as Record<string, unknown>)['passwordHash'];
      delete (safeAdmin as Record<string, unknown>)['refreshTokenHash'];
      return safeAdmin;
    }
    // If there is a pending doctor invitation for this email, create user and skeleton profile, then mark invitation accepted
    const invitation = await this.invitationsService.findPendingByEmail(dto.email);
    const doc = await this.usersService.create(dto);
    if (invitation) {
      await this.invitationsService.markAcceptedByEmail(dto.email);
      await this.doctorProfileService.createSkeleton(doc.id, doc.email, doc.name);
    }
    const userObj = doc.toObject();
    const safeUser: Record<string, unknown> = { ...userObj };
    delete (safeUser as Record<string, unknown>)['passwordHash'];
    delete (safeUser as Record<string, unknown>)['refreshTokenHash'];
    return safeUser;
  }

  async validateUser(email: string, password: string) {
    const e = (email || '').trim().toLowerCase();
    const admin = await this.adminService.findByEmail(e);
    if (admin) {
      const ok = await this.adminService.validatePassword(admin, password);
      if (!ok) throw new UnauthorizedException('Invalid credentials');
      return { doc: admin, isAdmin: true };
    }
    const user = await this.usersService.findByEmail(e);
    if (user) {
      const ok = await this.usersService.validatePassword(user, password);
      if (!ok) throw new UnauthorizedException('Invalid credentials');
      return { doc: user, isAdmin: false, isDoctorProfile: false as const };
    }
    // Fallback for legacy doctor_profiles: migrate to Users and proceed
    const doctor = await this.doctorProfileService.findByEmail(e).catch(() => null);
    if (doctor) {
      const ok = await this.doctorProfileService.validatePassword(doctor, password);
      if (!ok) throw new UnauthorizedException('Invalid credentials');
      const migrated = await this.usersService.upsertFromDoctorProfile(doctor);
      return { doc: migrated, isAdmin: false, isDoctorProfile: false as const };
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  async login(email: string, password: string) {
    const res = await this.validateUser(email, password);
    const { doc, isAdmin } = res as any;
    const roles = (Array.isArray(doc.roles) ? [...doc.roles] : []).map((r) =>
      String(r).trim().toLowerCase() === 'nurse' ? 'staff' : r
    );
    const role = roles[0];
    if (!isAdmin && role === 'staff') {
      const okDuty = await this.dutiesService.isStaffOnDutyNow(doc.id);
      if (!okDuty) throw new UnauthorizedException('Staff not on active duty shift');
    }
    if (!isAdmin && role === 'doctor') {
      const okDuty = await this.dutiesService.isDoctorOnDutyNow(doc.id);
      if (!okDuty) throw new UnauthorizedException('Doctor not on active duty shift');
    }
    const tokens = await this.issueTokens(
      doc.id,
      doc.email,
      roles,
      doc.passwordVersion,
      (doc as any).department,
      doc.name
    );
    const refreshTokenHash = await this.passwordService.hash(tokens.refreshToken);
    if (isAdmin) await this.adminService.setRefreshToken(doc.id, refreshTokenHash);
    else await this.usersService.setRefreshToken(doc.id, refreshTokenHash);
    const department = role === 'staff' ? (doc as any).department : undefined;
    return { ...tokens, department, role };
  }

  async refresh(userId: string, providedToken: string) {
    const admin = await this.adminService.findById(userId);
    if (admin && admin.refreshTokenHash) {
      const ok = await this.passwordService.verify(providedToken, admin.refreshTokenHash);
      if (!ok) throw new UnauthorizedException('Invalid token');
      const tokens = await this.issueTokens(
        admin.id,
        admin.email,
        admin.roles,
        admin.passwordVersion,
        (admin as any).department,
        admin.name
      );
      const refreshTokenHash = await this.passwordService.hash(tokens.refreshToken);
      await this.adminService.setRefreshToken(admin.id, refreshTokenHash);
      return tokens;
    }
    let user = await this.usersService.findById(userId);
    if (user && user.refreshTokenHash) {
      const ok = await this.passwordService.verify(providedToken, user.refreshTokenHash);
      if (!ok) throw new UnauthorizedException('Invalid token');
      const tokens = await this.issueTokens(
        user.id,
        user.email,
        user.roles,
        user.passwordVersion,
        (user as any).department,
        user.name
      );
      const refreshTokenHash = await this.passwordService.hash(tokens.refreshToken);
      await this.usersService.setRefreshToken(user.id, refreshTokenHash);
      return tokens;
    }
    // Legacy doctor token path: migrate and issue as User
    const doctor = await this.doctorProfileService.findByUserId(userId).catch(() => null);
    if (!doctor || !doctor.refreshTokenHash) throw new UnauthorizedException('Invalid token');
    const migrated = await this.usersService.upsertFromDoctorProfile(doctor);
    const okDoc = await this.passwordService.verify(providedToken, migrated.refreshTokenHash || '');
    if (!okDoc) throw new UnauthorizedException('Invalid token');
    const tokens = await this.issueTokens(
      migrated.id,
      migrated.email,
      migrated.roles,
      migrated.passwordVersion,
      (migrated as any).department,
      migrated.name
    );
    const refreshTokenHash = await this.passwordService.hash(tokens.refreshToken);
    await this.usersService.setRefreshToken(migrated.id, refreshTokenHash);
    return tokens;
  }

  async logout(userId: string) {
    const admin = await this.adminService.findById(userId);
    if (admin) {
      await this.adminService.clearRefreshToken(userId);
    } else {
      const user = await this.usersService.findById(userId);
      if (user) await this.usersService.clearRefreshToken(userId);
      else await this.doctorProfileService.clearRefreshToken(userId);
    }
    return { ok: true };
  }

  private async issueTokens(
    sub: string,
    email: string,
    roles: string[],
    pv: number,
    department?: string,
    name?: string
  ) {
    const normalizedRoles = (Array.isArray(roles) ? roles : [])
      .map((r) => String(r).trim().toLowerCase())
      .map((r) => (r === 'nurse' ? 'staff' : r))
      .map((r) => (r === 'pharmacist' ? 'pharmacy' : r))
      .filter(Boolean);
    const payload = { sub, email, roles: normalizedRoles, pv, department, name };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '24h'
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d'
    });
    return { accessToken, refreshToken };
  }
}
