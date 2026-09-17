import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolStatus, Role } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class SuperAdminService {
  constructor(private prisma: PrismaService) {}

  // -------------------------------------------------------------
  // SCHOOL MANAGEMENT (Flows #1 & #2)
  // -------------------------------------------------------------
  async getSchools(status?: SchoolStatus, search?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.school.findMany({
      where,
      include: {
        plan: true,
        enabledModules: true,
        schoolAdmins: { include: { user: true } },
        _count: { select: { students: true, staff: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSchoolById(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        plan: true,
        enabledModules: true,
        schoolAdmins: { include: { user: true } },
        _count: { select: { students: true, staff: true, classes: true } },
      },
    });
    if (!school) throw new NotFoundException(`School with ID ${id} not found`);
    return school;
  }

  async createSchool(data: {
    name: string;
    code: string;
    slug: string;
    address?: string;
    phone?: string;
    email?: string;
    status?: SchoolStatus;
    planId?: string;
    studentLimit?: number;
    staffLimit?: number;
    enabledModules?: string[];
    adminName: string;
    adminEmail: string;
    adminRole?: Role;
  }) {
    const existing = await this.prisma.school.findFirst({
      where: { OR: [{ code: data.code }, { slug: data.slug }] },
    });
    if (existing) {
      throw new BadRequestException('A school with this code or slug already exists');
    }

    // Default modules list
    const defaultModules = data.enabledModules || [
      'ADMISSION',
      'ACADEMICS',
      'ATTENDANCE',
      'FEES',
      'EXAMS',
      'TRANSPORT',
      'LIBRARY',
      'COMMUNICATION',
      'HR',
      'INVENTORY',
      'EVENTS',
      'HEALTH',
      'CERTIFICATES',
      'PROMOTION',
    ];

    return this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: data.name,
          code: data.code.toUpperCase(),
          slug: data.slug.toLowerCase(),
          address: data.address,
          phone: data.phone,
          email: data.email,
          status: data.status || SchoolStatus.ACTIVE,
          planId: data.planId,
          studentLimit: data.studentLimit || 1000,
          staffLimit: data.staffLimit || 100,
          enabledModules: {
            create: defaultModules.map((moduleKey) => ({
              moduleKey,
              isEnabled: true,
            })),
          },
        },
      });

      // Create primary school admin user
      const user = await tx.user.create({
        data: {
          email: data.adminEmail,
          name: data.adminName,
          role: data.adminRole || Role.SCHOOL_ADMIN,
          schoolId: school.id,
          passwordHash: '$2a$10$w8.dGjRkX/g8uXh2YvU/0.GvGg5FkX1rZf.7MvHqB/0yKjI1R9u8K', // default: 'Admin@123'
        },
      });

      await tx.schoolAdmin.create({
        data: {
          schoolId: school.id,
          userId: user.id,
          adminRole: data.adminRole || Role.SCHOOL_ADMIN,
          permissions: JSON.stringify(['ALL']),
          isInvited: true,
          invitationAccepted: false,
        },
      });

      return school;
    });
  }

  async updateSchoolStatus(id: string, status: SchoolStatus) {
    return this.prisma.school.update({
      where: { id },
      data: { status },
    });
  }

  async toggleSchoolModule(schoolId: string, moduleKey: string, isEnabled: boolean) {
    return this.prisma.enabledModule.upsert({
      where: { schoolId_moduleKey: { schoolId, moduleKey } },
      create: { schoolId, moduleKey, isEnabled },
      update: { isEnabled },
    });
  }

  // -------------------------------------------------------------
  // SCHOOL ADMINISTRATOR FLOW (Flow #3)
  // -------------------------------------------------------------
  async getSchoolAdmins(schoolId?: string) {
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    return this.prisma.schoolAdmin.findMany({
      where,
      include: {
        school: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addSchoolAdmin(data: {
    schoolId: string;
    name: string;
    email: string;
    adminRole: Role;
    permissions?: string[];
  }) {
    const school = await this.prisma.school.findUnique({ where: { id: data.schoolId } });
    if (!school) throw new NotFoundException('School not found');

    const existingUser = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          role: data.adminRole,
          schoolId: data.schoolId,
          passwordHash: '$2a$10$w8.dGjRkX/g8uXh2YvU/0.GvGg5FkX1rZf.7MvHqB/0yKjI1R9u8K', // default: 'Admin@123'
        },
      });

      return tx.schoolAdmin.create({
        data: {
          schoolId: data.schoolId,
          userId: user.id,
          adminRole: data.adminRole,
          permissions: JSON.stringify(data.permissions || ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT', 'MANAGE']),
          isInvited: true,
          invitationAccepted: false,
        },
        include: { user: true, school: true },
      });
    });
  }

  // -------------------------------------------------------------
  // SUPPORT ACCESS FLOW (Flow #4)
  // -------------------------------------------------------------
  async createSupportSession(superAdminId: string, schoolId: string, reason: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');

    const token = crypto.randomBytes(32).toString('hex');
    const session = await this.prisma.supportSession.create({
      data: {
        superAdminId,
        schoolId,
        reason,
        token,
      },
      include: { school: true },
    });

    // Record privileged audit entry
    await this.prisma.auditLog.create({
      data: {
        schoolId,
        userId: superAdminId,
        module: 'SUPPORT_ACCESS',
        action: 'PRIVILEGED_SUPPORT_SESSION_STARTED',
        recordId: session.id,
        newValue: JSON.stringify({ reason, schoolName: school.name }),
      },
    });

    return session;
  }

  async endSupportSession(sessionId: string) {
    const session = await this.prisma.supportSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        schoolId: session.schoolId,
        userId: session.superAdminId,
        module: 'SUPPORT_ACCESS',
        action: 'PRIVILEGED_SUPPORT_SESSION_ENDED',
        recordId: session.id,
      },
    });

    return session;
  }

  // -------------------------------------------------------------
  // SUBSCRIPTIONS & PLANS (Flow #6)
  // -------------------------------------------------------------
  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      include: { _count: { select: { schools: true } } },
      orderBy: { monthlyPrice: 'asc' },
    });
  }

  async createPlan(data: {
    name: string;
    description?: string;
    monthlyPrice: number;
    annualPrice: number;
    studentLimit: number;
    staffLimit: number;
    features: string[];
  }) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        description: data.description,
        monthlyPrice: data.monthlyPrice,
        annualPrice: data.annualPrice,
        studentLimit: data.studentLimit,
        staffLimit: data.staffLimit,
        features: JSON.stringify(data.features),
      },
    });
  }

  // -------------------------------------------------------------
  // AUDIT LOGS (Flow #7)
  // -------------------------------------------------------------
  async getAuditLogs(params: {
    schoolId?: string;
    module?: string;
    limit?: number;
  }) {
    const where: any = {};
    if (params.schoolId) where.schoolId = params.schoolId;
    if (params.module) where.module = params.module;

    return this.prisma.auditLog.findMany({
      where,
      include: { school: true, user: true },
      orderBy: { timestamp: 'desc' },
      take: params.limit || 100,
    });
  }

  // -------------------------------------------------------------
  // PLATFORM REPORTS & STATS
  // -------------------------------------------------------------
  async getPlatformStats() {
    const [totalSchools, activeSchools, totalStudents, totalStaff, plans] = await Promise.all([
      this.prisma.school.count(),
      this.prisma.school.count({ where: { status: SchoolStatus.ACTIVE } }),
      this.prisma.student.count(),
      this.prisma.staffProfile.count(),
      this.prisma.subscriptionPlan.findMany({
        include: { _count: { select: { schools: true } } },
      }),
    ]);

    const estimatedMRR = plans.reduce((acc, plan) => acc + plan.monthlyPrice * plan._count.schools, 0);

    return {
      totalSchools,
      activeSchools,
      totalStudents,
      totalStaff,
      estimatedMRR,
      planDistribution: plans.map((p) => ({
        name: p.name,
        schoolsCount: p._count.schools,
        monthlyPrice: p.monthlyPrice,
      })),
    };
  }
}
