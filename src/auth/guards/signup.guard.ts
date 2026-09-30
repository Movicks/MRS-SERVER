import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AdminService } from '../../admin/admin.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Role } from '../../common/types/roles';

@Injectable()
export class SignupGuard implements CanActivate {
  constructor(
    private readonly adminService: AdminService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const hasSuperAdmin = await this.adminService.adminExists();
    if (!hasSuperAdmin) return true;
    const auth = (req.headers['authorization'] ?? '') as string;
    if (!auth.startsWith('Bearer ')) return false;
    const token = auth.slice(7);
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET')
      }) as { roles?: Role[] };
      const roles = Array.isArray(payload.roles) ? payload.roles : [];
      return roles.includes('super_admin');
    } catch {
      return false;
    }
  }
}
