import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  public async resolveSchoolId(schoolId?: string): Promise<string> {
    if (!schoolId || schoolId === 'school-1') {
      const defaultSchool = await this.prisma.school.findFirst();
      return defaultSchool?.id || 'school-greenwood-high';
    }
    const schoolById = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (schoolById) return schoolById.id;

    const schoolBySlug = await this.prisma.school.findUnique({ where: { slug: schoolId } });
    if (schoolBySlug) return schoolBySlug.id;

    const fallback = await this.prisma.school.findFirst();
    return fallback?.id || 'school-greenwood-high';
  }

  async getStudents(
    schoolId: string,
    params?: {
      classId?: string;
      sectionId?: string;
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);
    const where: any = { schoolId: resolvedSchoolId };
    if (params?.classId) where.classId = params.classId;
    if (params?.sectionId) where.sectionId = params.sectionId;
    if (params?.status) where.status = params.status;
    if (params?.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { admissionNumber: { contains: params.search, mode: 'insensitive' } },
        { rollNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 50;

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: {
          gradeClass: true,
          section: true,
          parent: true,
        },
        orderBy: [{ classId: 'asc' }, { rollNumber: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    return { students, total, page, limit };
  }

  // Complete 360-degree central student connection
  async getStudent360(schoolId: string, studentId: string) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: resolvedSchoolId },
      include: {
        gradeClass: true,
        section: true,
        academicYear: true,
        parent: true,
        documents: true,
        healthRecord: true,
        incidents: { orderBy: { dateTime: 'desc' } },
        attendances: {
          take: 30,
          orderBy: { session: { date: 'desc' } },
          include: { session: true },
        },
        submissions: {
          take: 10,
          orderBy: { submittedAt: 'desc' },
          include: { homework: { include: { subject: true } } },
        },
        marks: {
          take: 20,
          include: { schedule: { include: { exam: true } } },
        },
        reportCards: {
          include: { exam: true },
        },
        invoices: {
          orderBy: { dueDate: 'desc' },
          include: { payments: true },
        },
        transport: {
          include: {
            route: { include: { vehicle: true } },
            stop: true,
          },
        },
        certificates: {
          orderBy: { issueDate: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student not found`);
    }

    // Calculate quick 360 stats
    const totalAttendance = student.attendances.length;
    const presentAttendance = student.attendances.filter((a) => a.status === 'PRESENT').length;
    const attendancePercentage = totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : 100;

    const totalFeeDue = student.invoices.reduce((acc, inv) => acc + inv.balanceAmount, 0);
    const totalFeePaid = student.invoices.reduce((acc, inv) => acc + inv.paidAmount, 0);

    return {
      student,
      stats: {
        attendancePercentage,
        totalFeeDue,
        totalFeePaid,
        activeIncidents: student.incidents.length,
        issuedCertificates: student.certificates.length,
      },
    };
  }

  async updateStudent(schoolId: string, studentId: string, data: any) {
    return this.prisma.student.update({
      where: { id: studentId, schoolId },
      data: {
        rollNumber: data.rollNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        dob: data.dob ? new Date(data.dob) : undefined,
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        address: data.address,
        status: data.status,
      },
    });
  }
}
