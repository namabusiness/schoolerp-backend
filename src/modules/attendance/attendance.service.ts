import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  // Get or initialize session for a date
  async getSession(schoolId: string, sectionId: string, dateStr: string) {
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    let session = await this.prisma.attendanceSession.findUnique({
      where: {
        schoolId_sectionId_date: {
          schoolId,
          sectionId,
          date: targetDate,
        },
      },
      include: {
        records: {
          include: { student: true },
        },
      },
    });

    // If session doesn't exist yet, populate with active students
    if (!session) {
      const students = await this.prisma.student.findMany({
        where: { schoolId, sectionId, status: 'ACTIVE' },
        orderBy: { rollNumber: 'asc' },
      });

      session = await this.prisma.attendanceSession.create({
        data: {
          schoolId,
          sectionId,
          date: targetDate,
          records: {
            create: students.map((s) => ({
              schoolId,
              studentId: s.id,
              status: AttendanceStatus.PRESENT, // Default all present
            })),
          },
        },
        include: {
          records: {
            include: { student: true },
          },
        },
      });
    }

    return session;
  }

  // Bulk update attendance: "Mark All Present" or batch exception update
  async submitAttendance(
    schoolId: string,
    sessionId: string,
    records: { studentId: string; status: AttendanceStatus; remarks?: string }[],
    lockSession: boolean = false,
  ) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BadRequestException('Session not found');
    if (session.isLocked) throw new BadRequestException('Attendance for this session is locked');

    await this.prisma.$transaction(async (tx) => {
      for (const r of records) {
        const existing = await tx.studentAttendance.findFirst({
          where: { sessionId, studentId: r.studentId },
        });
        if (existing) {
          await tx.studentAttendance.update({
            where: { id: existing.id },
            data: { status: r.status, remarks: r.remarks },
          });
        } else {
          await tx.studentAttendance.create({
            data: {
              schoolId,
              sessionId,
              studentId: r.studentId,
              status: r.status,
              remarks: r.remarks,
            },
          });
        }
      }

      if (lockSession) {
        await tx.attendanceSession.update({
          where: { id: sessionId },
          data: { isLocked: true },
        });
      }
    });

    return this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { records: { include: { student: true } } },
    });
  }

  // Monthly summary metrics
  async getMonthlyStats(schoolId: string, sectionId?: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const records = await this.prisma.studentAttendance.findMany({
      where: {
        schoolId,
        session: {
          date: { gte: startOfMonth },
          sectionId: sectionId || undefined,
        },
      },
    });

    const total = records.length;
    const present = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
    const absent = records.filter((r) => r.status === AttendanceStatus.ABSENT).length;
    const late = records.filter((r) => r.status === AttendanceStatus.LATE).length;
    const leave = records.filter((r) => r.status === AttendanceStatus.LEAVE).length;

    return {
      total,
      present,
      absent,
      late,
      leave,
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : 100,
    };
  }

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

  // Monthly Matrix for Excel / Sheet Export
  async getMonthlyMatrix(schoolId: string, sectionId: string, year: number, month: number) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const daysInMonth = endDate.getDate();

    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { gradeClass: true },
    });

    const students = await this.prisma.student.findMany({
      where: {
        OR: [{ schoolId: resolvedId }, { schoolId }],
        sectionId,
        status: 'ACTIVE',
      },
      orderBy: [{ rollNumber: 'asc' }, { firstName: 'asc' }],
    });

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        OR: [{ schoolId: resolvedId }, { schoolId }],
        sectionId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        records: true,
      },
      orderBy: { date: 'asc' },
    });

    const studentRows = students.map((student) => {
      const dailyStatus: Record<number, string> = {};
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;
      let halfDayCount = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const session = sessions.find((s) => new Date(s.date).getDate() === day);
        if (session) {
          const record = session.records.find((r) => r.studentId === student.id);
          const status = record ? record.status : 'NOT_MARKED';
          dailyStatus[day] = status;
          if (status === 'PRESENT') presentCount++;
          else if (status === 'ABSENT') absentCount++;
          else if (status === 'LATE') lateCount++;
          else if (status === 'LEAVE') leaveCount++;
          else if (status === 'HALF_DAY') halfDayCount++;
        } else {
          const curDate = new Date(year, month - 1, day);
          dailyStatus[day] = curDate.getDay() === 0 ? 'HOLIDAY' : '-';
        }
      }

      const totalWorkingDays = sessions.length;
      const rate = totalWorkingDays > 0 ? Math.round(((presentCount + (lateCount * 0.5) + (halfDayCount * 0.5)) / totalWorkingDays) * 100) : 100;

      return {
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber || '-',
        name: `${student.firstName} ${student.lastName}`.trim(),
        gender: student.gender,
        dailyStatus,
        presentCount,
        absentCount,
        lateCount,
        leaveCount,
        halfDayCount,
        totalWorkingDays,
        attendanceRate: rate,
      };
    });

    return {
      year,
      month,
      daysInMonth,
      sectionName: section?.name || 'Section A',
      className: section?.gradeClass?.name || 'Class',
      totalWorkingDays: sessions.length,
      students: studentRows,
    };
  }
}

