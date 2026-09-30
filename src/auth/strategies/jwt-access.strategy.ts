import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  email: string;
  roles?: string[];
  role?: string;
  pv: number;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET')
    });
  }

  async validate(payload: JwtPayload) {
    const rawRoles =
      Array.isArray(payload.roles) && payload.roles.length > 0
        ? payload.roles
        : payload.role
          ? [payload.role]
          : [];
    const roles = rawRoles
      .map((r) => String(r).trim().toLowerCase())
      .map((r) => (r === 'nurse' ? 'staff' : r))
      .map((r) => (r === 'pharmacist' ? 'pharmacy' : r))
      .filter(Boolean);
    return { userId: payload.sub, email: payload.email, roles, pv: payload.pv };
  }
}
