import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaveStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StaffHrService {
  constructor(private prisma: PrismaService) {}

  private async resolveSchoolId(schoolId: string): Promise<string> {
    if (!schoolId) return 'school-greenwood-high';
    const byId = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (byId) return byId.id;

    const bySlug = await this.prisma.school.findUnique({ where: { slug: schoolId } });
    if (bySlug) return bySlug.id;

    const byPrefix = await this.prisma.school.findUnique({ where: { id: `school-${schoolId}` } });
    if (byPrefix) return byPrefix.id;

    const fallback = await this.prisma.school.findFirst();
    return fallback?.id || 'school-greenwood-high';
  }

  // Departments
  async getDepartments(schoolId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.department.findMany({
      where: {
        OR: [{ schoolId: resolvedId }, { schoolId }],
      },
      include: { _count: { select: { staff: true } } },
    });
  }

  async createDepartment(schoolId: string, name: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.department.create({
      data: { schoolId: resolvedId, name },
    });
  }

  // Staff & Faculty Profiles
  async getStaff(schoolId: string, departmentId?: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const where: any = {
      OR: [{ schoolId: resolvedId }, { schoolId }],
    };
    if (departmentId) where.departmentId = departmentId;
    return this.prisma.staffProfile.findMany({
      where,
      include: {
        department: true,
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async addStaff(schoolId: string, data: any) {
    const resolvedId = await this.resolveSchoolId(schoolId);
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

    return this.prisma.staffProfile.create({
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
        designation: data.designation || 'Teacher',
        role: data.role || 'TEACHER',
        departmentId: data.departmentId || null,
        phone: data.phone,
        email: data.email,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
        salary: Number(data.salary) || 3500,
        status: data.status || 'ACTIVE',
      },
      include: {
        department: true,
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
    });
  }

  async updateStaff(schoolId: string, id: string, data: any) {
    return this.prisma.staffProfile.update({
      where: { id },
      data: {
        name: data.name,
        gender: data.gender,
        dob: data.dob ? new Date(data.dob) : undefined,
        bloodGroup: data.bloodGroup,
        photoUrl: data.photoUrl,
        aadharNumber: data.aadharNumber,
        qualification: data.qualification,
        specialization: data.specialization,
        experienceYears: data.experienceYears !== undefined ? Number(data.experienceYears) : undefined,
        employmentType: data.employmentType,
        emergencyPhone: data.emergencyPhone,
        address: data.address,
        designation: data.designation,
        role: data.role,
        departmentId: data.departmentId,
        phone: data.phone,
        email: data.email,
        salary: data.salary !== undefined ? Number(data.salary) : undefined,
        status: data.status,
      },
      include: { department: true, user: true },
    });
  }

  async deleteStaff(schoolId: string, id: string) {
    return this.prisma.staffProfile.delete({
      where: { id },
    });
  }

  // Leaves
  async getLeaves(schoolId: string, status?: LeaveStatus) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const where: any = {
      OR: [{ schoolId: resolvedId }, { schoolId }],
    };
    if (status) where.status = status;
    return this.prisma.leaveApplication.findMany({
      where,
      include: { staff: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async applyLeave(schoolId: string, data: any) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.leaveApplication.create({
      data: {
        schoolId: resolvedId,
        staffId: data.staffId,
        leaveType: data.leaveType || 'CASUAL',
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        status: LeaveStatus.PENDING,
      },
    });
  }

  async updateLeaveStatus(schoolId: string, leaveId: string, status: LeaveStatus) {
    return this.prisma.leaveApplication.update({
      where: { id: leaveId },
      data: { status },
    });
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
