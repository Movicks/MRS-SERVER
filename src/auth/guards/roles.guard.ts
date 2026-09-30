import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Role } from '../../common/types/roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    const rawUserRoles = req.user?.roles;
    const userRoles = (Array.isArray(rawUserRoles) ? rawUserRoles : [])
      .map((r) => String(r).trim().toLowerCase())
      .filter(Boolean);
    const requiredRoles = required.map((r) => String(r).trim().toLowerCase()).filter(Boolean);
    return requiredRoles.some((r) => userRoles.includes(r));
  }
}
