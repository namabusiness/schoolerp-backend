import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FastCacheService } from '../../common/cache/fast-cache.service';
import { LeaveStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StaffHrService {
  constructor(
    private prisma: PrismaService,
    private fastCache: FastCacheService,
  ) {}

  public clearStaffCache(schoolId?: string) {
    this.fastCache.delByPrefix('staff-hr:');
  }

  private async resolveSchoolId(schoolId: string): Promise<string> {
    if (!schoolId) return 'school-greenwood-high';
    return this.fastCache.getOrSet(`school_id:${schoolId}`, async () => {
      const byId = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (byId) return byId.id;

      const bySlug = await this.prisma.school.findUnique({ where: { slug: schoolId } });
      if (bySlug) return bySlug.id;

      const byPrefix = await this.prisma.school.findUnique({ where: { id: `school-${schoolId}` } });
      if (byPrefix) return byPrefix.id;

      const fallback = await this.prisma.school.findFirst();
      return fallback?.id || 'school-greenwood-high';
    }, 3600);
  }

  // Departments
  async getDepartments(schoolId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.fastCache.getOrSet(`staff-hr:departments:${resolvedId}`, async () => {
      return this.prisma.department.findMany({
        where: {
          OR: [{ schoolId: resolvedId }, { schoolId }],
        },
        include: { _count: { select: { staff: true } } },
      });
    }, 60);
  }

  async createDepartment(schoolId: string, name: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const res = await this.prisma.department.create({
      data: { schoolId: resolvedId, name },
    });
    this.clearStaffCache(resolvedId);
    return res;
  }

  // Staff & Faculty Profiles
  async getStaff(schoolId: string, departmentId?: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const cacheKey = `staff-hr:staff:${resolvedId}:${departmentId || 'ALL'}`;
    return this.fastCache.getOrSet(cacheKey, async () => {
      const where: any = {
        OR: [{ schoolId: resolvedId }, { schoolId }],
      };
      if (departmentId) where.departmentId = departmentId;
      return this.prisma.staffProfile.findMany({
        where,
        include: {
          department: true,
          user: { select: { id: true, email: true, role: true, isActive: true } },
          taughtSubjects: {
            include: { gradeClass: true },
            orderBy: { name: 'asc' },
          },
          managedClasses: true,
          managedSections: { include: { gradeClass: true } },
        },
        orderBy: { name: 'asc' },
      });
    }, 60);
  }

  async addStaff(schoolId: string, data: any) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    this.clearStaffCache(resolvedId);
    const employeeCode = data.employeeCode || `EMP-${Date.now().toString().slice(-5)}`;

    // Optional user login creation if requested
    let userId: string | null = null;
    if (data.createLogin || data.password) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!existingUser) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.password || 'Faculty@123', salt);
        const userRole = (data.role as Role) || Role.TEACHER;

        const newUser = await this.prisma.user.create({
          data: {
            email: data.email,
            name: data.name,
            role: userRole,
            schoolId: resolvedId,
            passwordHash,
            phone: data.phone || null,
          },
        });
        userId = newUser.id;
      } else {
        userId = existingUser.id;
      }
    }

    const createdStaff = await this.prisma.staffProfile.create({
      data: {
        schoolId: resolvedId,
        userId,
        employeeCode,
        name: data.name,
        gender: data.gender || null,
        dob: data.dob ? new Date(data.dob) : null,
        bloodGroup: data.bloodGroup || null,
        photoUrl: data.photoUrl || null,
        aadharNumber: data.aadharNumber || null,
        qualification: data.qualification || null,
        specialization: data.specialization || null,
        experienceYears: data.experienceYears !== undefined ? Number(data.experienceYears) : 0,
        employmentType: data.employmentType || 'FULL_TIME',
        emergencyPhone: data.emergencyPhone || null,
        address: data.address || null,
        designation: data.designation || (data.role === 'DRIVER' ? 'Fleet Driver' : data.role === 'TRANSPORT_MANAGER' ? 'Transport Manager' : 'Teacher'),
        role: data.role || 'TEACHER',
        departmentId: data.departmentId || null,
        phone: data.phone,
        email: data.email,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
        salary: Number(data.salary) || 35000,
        status: data.status || 'ACTIVE',
      },
      include: {
        department: true,
        user: { select: { id: true, email: true, role: true, isActive: true } },
        taughtSubjects: {
          include: { gradeClass: true },
          orderBy: { name: 'asc' },
        },
        timetableSlots: {
          include: {
            period: true,
            section: { include: { gradeClass: true } },
            subject: true,
          },
          orderBy: [{ dayOfWeek: 'asc' }, { period: { periodNumber: 'asc' } }],
        },
        managedClasses: true,
        managedSections: { include: { gradeClass: true } },
      },
    });

    // If role is DRIVER, also create or link a Driver record
    if (data.role === 'DRIVER' || data.role === Role.DRIVER) {
      const existingDriver = await this.prisma.driver.findFirst({
        where: { OR: [{ userId }, { phone: data.phone || '' }] },
      });
      if (!existingDriver) {
        await this.prisma.driver.create({
          data: {
            schoolId: resolvedId,
            userId,
            name: data.name,
            phone: data.phone || '9876543210',
            licenseNumber: data.licenseNumber || data.aadharNumber || `DL-${Date.now().toString().slice(-6)}`,
            status: 'ACTIVE',
            photoUrl: data.photoUrl || null,
            address: data.address || null,
            emergencyContact: data.emergencyPhone || null,
          },
        });
      } else if (userId) {
        await this.prisma.driver.update({
          where: { id: existingDriver.id },
          data: { userId, schoolId: resolvedId },
        });
      }
    }

    // If role is PRINCIPAL or SCHOOL_ADMIN, ensure SchoolAdmin entry exists
    if (data.role === 'PRINCIPAL' || data.role === 'SCHOOL_ADMIN') {
      if (userId) {
        const existingAdmin = await this.prisma.schoolAdmin.findUnique({
          where: { userId },
        });
        if (!existingAdmin) {
          await this.prisma.schoolAdmin.create({
            data: {
              schoolId: resolvedId,
              userId,
              adminRole: data.role as Role,
              permissions: JSON.stringify(['ALL']),
            },
          });
        }
      }
    }

    this.clearStaffCache(resolvedId);
    return createdStaff;
  }

  async updateStaff(schoolId: string, id: string, data: any) {
    // 1. Handle Subject assignments and Timetable Slot synchronization
    if (data.subjectIds && Array.isArray(data.subjectIds)) {
      // Unassign subjects previously taught by this teacher that were deselected
      await this.prisma.subject.updateMany({
        where: {
          teacherId: id,
          id: { notIn: data.subjectIds },
        },
        data: {
          teacherId: null,
        },
      });

      // Unassign timetable slots for deselected subjects where this teacher was assigned
      await this.prisma.timetableSlot.updateMany({
        where: {
          teacherId: id,
          subjectId: { notIn: data.subjectIds },
        },
        data: {
          teacherId: null,
        },
      });

      // Assign all selected subjects to this teacher
      if (data.subjectIds.length > 0) {
        await this.prisma.subject.updateMany({
          where: {
            id: { in: data.subjectIds },
          },
          data: {
            teacherId: id,
          },
        });

        // Synchronize timetable slots for these subjects: link this teacher
        await this.prisma.timetableSlot.updateMany({
          where: {
            subjectId: { in: data.subjectIds },
          },
          data: {
            teacherId: id,
          },
        });
      }
    }

    const res = await this.prisma.staffProfile.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        employeeCode: data.employeeCode !== undefined ? data.employeeCode : undefined,
        gender: data.gender !== undefined ? data.gender : undefined,
        dob: data.dob ? new Date(data.dob) : undefined,
        bloodGroup: data.bloodGroup !== undefined ? data.bloodGroup : undefined,
        photoUrl: data.photoUrl !== undefined ? data.photoUrl : undefined,
        aadharNumber: data.aadharNumber !== undefined ? data.aadharNumber : undefined,
        qualification: data.qualification !== undefined ? data.qualification : undefined,
        specialization: data.specialization !== undefined ? data.specialization : undefined,
        experienceYears: data.experienceYears !== undefined ? Number(data.experienceYears) : undefined,
        employmentType: data.employmentType !== undefined ? data.employmentType : undefined,
        emergencyPhone: data.emergencyPhone !== undefined ? data.emergencyPhone : undefined,
        address: data.address !== undefined ? data.address : undefined,
        designation: data.designation !== undefined ? data.designation : undefined,
        role: data.role !== undefined ? data.role : undefined,
        departmentId: data.departmentId !== undefined ? (data.departmentId || null) : undefined,
        phone: data.phone !== undefined ? data.phone : undefined,
        email: data.email !== undefined ? data.email : undefined,
        salary: data.salary !== undefined ? Number(data.salary) : undefined,
        status: data.status !== undefined ? data.status : undefined,
      },
      include: {
        department: true,
        user: { select: { id: true, email: true, role: true, isActive: true } },
        taughtSubjects: {
          include: { gradeClass: true },
          orderBy: { name: 'asc' },
        },
        timetableSlots: {
          include: {
            period: true,
            section: { include: { gradeClass: true } },
            subject: true,
          },
          orderBy: [{ dayOfWeek: 'asc' }, { period: { periodNumber: 'asc' } }],
        },
        managedClasses: true,
        managedSections: { include: { gradeClass: true } },
      },
    });
    this.clearStaffCache(schoolId);
    return res;
  }

  async deleteStaff(schoolId: string, id: string) {
    const res = await this.prisma.staffProfile.delete({
      where: { id },
    });
    this.clearStaffCache(schoolId);
    return res;
  }

  // Leaves
  async getLeaves(schoolId: string, status?: LeaveStatus) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const cacheKey = `staff-hr:leaves:${resolvedId}:${status || 'ALL'}`;
    return this.fastCache.getOrSet(cacheKey, async () => {
      const where: any = {
        OR: [{ schoolId: resolvedId }, { schoolId }],
      };
      if (status) where.status = status;
      return this.prisma.leaveApplication.findMany({
        where,
        include: { staff: true },
        orderBy: { startDate: 'desc' },
      });
    }, 30);
  }

  async applyLeave(schoolId: string, data: any) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    let targetStaffId = data.staffId;

    // Verify or resolve staffId to an existing StaffProfile
    let staff = null;
    if (targetStaffId && targetStaffId !== 'staff-default') {
      staff = await this.prisma.staffProfile.findFirst({
        where: {
          OR: [
            { id: targetStaffId },
            { userId: targetStaffId },
          ],
        },
      });
    }

    if (!staff) {
      // Fallback to first staff in this school
      staff = await this.prisma.staffProfile.findFirst({
        where: {
          OR: [{ schoolId: resolvedId }, { schoolId }],
        },
      });
    }

    if (!staff) {
      throw new BadRequestException('No valid staff profile found to submit leave application.');
    }

    const res = await this.prisma.leaveApplication.create({
      data: {
        schoolId: resolvedId,
        staffId: staff.id,
        leaveType: data.leaveType || 'CASUAL',
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        status: LeaveStatus.PENDING,
      },
    });
    this.clearStaffCache(resolvedId);
    return res;
  }

  async updateLeaveStatus(schoolId: string, leaveId: string, status: LeaveStatus) {
    const res = await this.prisma.leaveApplication.update({
      where: { id: leaveId },
      data: { status },
    });
    this.clearStaffCache(schoolId);
    return res;
  }

  // Payroll & Payslips
  async getPayrolls(schoolId: string, month: number, year: number) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.payrollRecord.findMany({
      where: {
        schoolId: resolvedId,
        month: Number(month),
        year: Number(year),
      },
      include: { staff: { include: { department: true } } },
    });
  }

  async runPayroll(schoolId: string, month: number, year: number) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const staffList = await this.prisma.staffProfile.findMany({
      where: {
        OR: [{ schoolId: resolvedId }, { schoolId }],
        status: 'ACTIVE',
      },
    });

    const records = [];
    for (const staff of staffList) {
      const basicSalary = staff.salary;
      const allowances = Math.round(basicSalary * 0.15);
      const deductions = Math.round(basicSalary * 0.05);
      const netSalary = basicSalary + allowances - deductions;

      const record = await this.prisma.payrollRecord.upsert({
        where: {
          id: `${staff.id}-${month}-${year}`,
        },
        create: {
          id: `${staff.id}-${month}-${year}`,
          schoolId: resolvedId,
          staffId: staff.id,
          month: Number(month),
          year: Number(year),
          basicSalary,
          allowances,
          deductions,
          netSalary,
          status: 'PAID',
          paidDate: new Date(),
        },
        update: {
          basicSalary,
          allowances,
          deductions,
          netSalary,
          status: 'PAID',
          paidDate: new Date(),
        },
      });
      records.push(record);
    }
    return records;
  }
}
