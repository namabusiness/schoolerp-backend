import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolStatus, Role } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

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

  // -------------------------------------------------------------
  // USER ACCESS SETUP FLOW (Super Admin Provisioning)
  // -------------------------------------------------------------
  async getUsers(role?: string, schoolId?: string) {
    const where: any = {};
    if (role) where.role = role as Role;
    if (schoolId) where.schoolId = schoolId;

    return this.prisma.user.findMany({
      where,
      include: {
        school: { select: { id: true, name: true, slug: true, code: true } },
        staffProfile: { select: { id: true, employeeCode: true, designation: true, phone: true } },
        driverProfile: { select: { id: true, licenseNumber: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setupUserAccess(data: {
    schoolId: string;
    name: string;
    email: string;
    phone?: string;
    password?: string;
    role: Role;
    profileType?: 'STAFF' | 'DRIVER' | 'ADMIN';
    profileId?: string;
  }) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password || 'Access@123', salt);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    let user;
    if (existingUser) {
      user = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: data.role,
          schoolId: data.schoolId,
          passwordHash,
          name: data.name,
          phone: data.phone || existingUser.phone,
          isActive: true,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          role: data.role,
          schoolId: data.schoolId,
          phone: data.phone || null,
          passwordHash,
          isActive: true,
        },
      });
    }

    // 1. Explicit profile link if profileId supplied
    if (data.profileType === 'STAFF' && data.profileId) {
      await this.prisma.staffProfile.update({
        where: { id: data.profileId },
        data: { userId: user.id, schoolId: data.schoolId },
      });
    } else if (data.profileType === 'DRIVER' && data.profileId) {
      await this.prisma.driver.update({
        where: { id: data.profileId },
        data: { userId: user.id, schoolId: data.schoolId },
      });
    } else {
      // 2. Automatic profile provisioning according to the role and school
      if (['TEACHER', 'STAFF', 'TRANSPORT_MANAGER', 'PRINCIPAL'].includes(data.role)) {
        const existingStaff = await this.prisma.staffProfile.findFirst({
          where: { OR: [{ userId: user.id }, { email: data.email }] },
        });

        if (!existingStaff) {
          const empCode = `EMP-${Date.now().toString().slice(-5)}`;
          let designation = 'Staff Member';
          if (data.role === 'TEACHER') designation = 'Teacher';
          else if (data.role === 'PRINCIPAL') designation = 'Principal';
          else if (data.role === 'TRANSPORT_MANAGER') designation = 'Transport Manager';

          await this.prisma.staffProfile.create({
            data: {
              schoolId: data.schoolId,
              userId: user.id,
              name: data.name,
              email: data.email,
              phone: data.phone || '9876543210',
              employeeCode: empCode,
              role: data.role,
              designation,
              status: 'ACTIVE',
              joiningDate: new Date(),
            } as any,
          });
        } else {
          await this.prisma.staffProfile.update({
            where: { id: existingStaff.id },
            data: {
              userId: user.id,
              schoolId: data.schoolId,
              name: data.name,
              role: data.role,
            },
          });
        }
      }

      if (data.role === 'DRIVER') {
        const existingDriver = await this.prisma.driver.findFirst({
          where: {
            OR: [
              { userId: user.id },
              ...(data.phone ? [{ phone: data.phone }] : []),
            ],
          },
        });

        if (!existingDriver) {
          await this.prisma.driver.create({
            data: {
              schoolId: data.schoolId,
              userId: user.id,
              name: data.name,
              phone: data.phone || '9876543210',
              licenseNumber: `DL-${Date.now().toString().slice(-6)}`,
              status: 'ACTIVE',
            },
          });
        } else {
          await this.prisma.driver.update({
            where: { id: existingDriver.id },
            data: {
              userId: user.id,
              schoolId: data.schoolId,
              name: data.name,
            },
          });
        }
      }

      if (data.role === 'SCHOOL_ADMIN' || data.role === 'PRINCIPAL') {
        const existingAdmin = await this.prisma.schoolAdmin.findUnique({
          where: { userId: user.id },
        });

        if (!existingAdmin) {
          await this.prisma.schoolAdmin.create({
            data: {
              schoolId: data.schoolId,
              userId: user.id,
              adminRole: data.role,
              permissions: JSON.stringify(['ALL']),
            },
          });
        } else {
          await this.prisma.schoolAdmin.update({
            where: { id: existingAdmin.id },
            data: {
              schoolId: data.schoolId,
              adminRole: data.role,
            },
          });
        }
      }
    }

    return user;
  }

  async toggleUserStatus(userId: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }
}
