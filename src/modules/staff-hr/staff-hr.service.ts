import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaveStatus } from '@prisma/client';

@Injectable()
export class StaffHrService {
  constructor(private prisma: PrismaService) {}

  // Departments
  async getDepartments(schoolId: string) {
    return this.prisma.department.findMany({
      where: { schoolId },
      include: { _count: { select: { staff: true } } },
    });
  }

  async createDepartment(schoolId: string, name: string) {
    return this.prisma.department.create({
      data: { schoolId, name },
    });
  }

  // Staff Profiles
  async getStaff(schoolId: string, departmentId?: string) {
    const where: any = { schoolId };
    if (departmentId) where.departmentId = departmentId;
    return this.prisma.staffProfile.findMany({
      where,
      include: { department: true },
      orderBy: { name: 'asc' },
    });
  }

  async addStaff(schoolId: string, data: any) {
    const employeeCode = `EMP-${Date.now().toString().slice(-5)}`;
    return this.prisma.staffProfile.create({
      data: {
        schoolId,
        employeeCode,
        name: data.name,
        designation: data.designation,
        departmentId: data.departmentId,
        phone: data.phone,
        email: data.email,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
        salary: Number(data.salary) || 3500,
        status: 'ACTIVE',
      },
    });
  }

  // Leaves
  async getLeaves(schoolId: string, status?: LeaveStatus) {
    const where: any = { schoolId };
    if (status) where.status = status;
    return this.prisma.leaveApplication.findMany({
      where,
      include: { staff: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async applyLeave(schoolId: string, data: any) {
    return this.prisma.leaveApplication.create({
      data: {
        schoolId,
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
      where: { id: leaveId, schoolId },
      data: { status },
    });
  }

  // Payroll & Payslips
  async getPayrolls(schoolId: string, month: number, year: number) {
    return this.prisma.payrollRecord.findMany({
      where: { schoolId, month: Number(month), year: Number(year) },
      include: { staff: { include: { department: true } } },
    });
  }

  async runPayroll(schoolId: string, month: number, year: number) {
    const staffList = await this.prisma.staffProfile.findMany({
      where: { schoolId, status: 'ACTIVE' },
    });

    const records = [];
    for (const staff of staffList) {
      const basicSalary = staff.salary;
      const allowances = Math.round(basicSalary * 0.15);
      const deductions = Math.round(basicSalary * 0.05);
      const netSalary = basicSalary + allowances - deductions;

      const record = await this.prisma.payrollRecord.create({
        data: {
          schoolId,
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
      });
      records.push(record);
    }
    return records;
  }
}
