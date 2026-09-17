import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context is missing');
    }

    // Super Admin has global tenant privileges
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    if (!user.schoolId) {
      throw new ForbiddenException('User is not assigned to a school tenant');
    }

    // If request contains schoolId param or body, enforce match
    const requestedSchoolId =
      request.params?.schoolId ||
      request.body?.schoolId ||
      request.query?.schoolId;

    if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
      throw new ForbiddenException('Tenant isolation violation: Access across school boundaries is forbidden');
    }

    return true;
  }
}
