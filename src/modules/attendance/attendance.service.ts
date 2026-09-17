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
}
