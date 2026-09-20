import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@Injectable()
export class DriverAuthGuard extends JwtAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    jwtService: JwtService,
    configService: ConfigService,
  ) {
    super(jwtService, configService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (!request.headers.authorization || request.headers['x-demo-role']) {
      throw new UnauthorizedException('A valid driver JWT is required');
    }
    await super.canActivate(context);
    const user = request.user;

    if (!user?.id || user.role !== Role.DRIVER) {
      throw new ForbiddenException('Driver role is required');
    }

    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, schoolId: true, isActive: true, role: true },
    });
    if (!account || account.role !== Role.DRIVER || !account.isActive) {
      throw new UnauthorizedException('Driver account is inactive or unavailable');
    }
    if (!account.schoolId) {
      throw new ForbiddenException('Driver is not assigned to a school');
    }

    const driver = await this.prisma.driver.findUnique({
      where: { userId: account.id },
      select: { id: true, schoolId: true, status: true },
    });
    if (!driver || driver.schoolId !== account.schoolId || driver.status !== 'ACTIVE') {
      throw new ForbiddenException('Driver assignment is inactive or unavailable');
    }

    request.driver = driver;
    request.user.schoolId = account.schoolId;
    return true;
  }
}