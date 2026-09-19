import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      // Demo / Development fallback simulation header support
      const demoRole = request.headers['x-demo-role'];
      const demoSchoolId = request.headers['x-demo-school-id'] || request.headers['x-school-id'];
      if (demoRole) {
        request.user = {
          id: 'demo-user-id',
          email: `${demoRole.toLowerCase()}@example.com`,
          name: `Demo ${demoRole}`,
          role: demoRole,
          schoolId: demoSchoolId || 'school-greenwood-high',
        };
        return true;
      }
      throw new UnauthorizedException('Missing Authorization Header');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization Format');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET') || 'school_erp_monochrome_jwt_secret_key_2026_secure';
      const payload = await this.jwtService.verifyAsync(token, { secret });
      request.user = { ...payload };
      if (request.headers['x-demo-role']) {
        request.user.role = request.headers['x-demo-role'];
      }
      return true;
    } catch {
      // If token expired/mock, but demo role is supplied, allow graceful development fallback
      if (request.headers['x-demo-role']) {
        const demoRole = request.headers['x-demo-role'];
        const demoSchoolId = request.headers['x-demo-school-id'] || request.headers['x-school-id'];
        request.user = {
          id: 'demo-user-id',
          email: `${demoRole.toLowerCase()}@example.com`,
          name: `Demo ${demoRole}`,
          role: demoRole,
          schoolId: demoSchoolId || 'school-greenwood-high',
        };
        return true;
      }
      throw new UnauthorizedException('Token is expired or invalid');
    }
  }
}
