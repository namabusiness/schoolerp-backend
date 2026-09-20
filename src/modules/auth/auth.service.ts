import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password?: string, demoRole?: string) {
    // If demo role is selected directly for rapid testing
    if (demoRole) {
      const demoUser = {
        id: `demo-${demoRole.toLowerCase()}-id`,
        email: email || `${demoRole.toLowerCase()}@schoolerp.com`,
        name: `Demo ${demoRole.replace('_', ' ')}`,
        role: demoRole,
        schoolId: demoRole === 'SUPER_ADMIN' ? null : 'school-greenwood-high',
        schoolSlug: demoRole === 'SUPER_ADMIN' ? null : 'greenwood-high',
      };
      const token = this.jwtService.sign(demoUser);
      return {
        accessToken: token,
        user: demoUser,
      };
    }

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { school: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    if (!password || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
      schoolSlug: user.school?.slug,
    };

    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: payload,
    };
  }

  async setupPassword(userId: string, newPassword: string) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true, message: 'Password configured successfully' };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        avatarUrl: true,
        schoolId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        school: true,
        adminProfile: true,
        staffProfile: true,
        driverProfile: true,
        studentProfile: true,
      },
    });
  }
}
