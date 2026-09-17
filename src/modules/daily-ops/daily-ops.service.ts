import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DailyOpsService {
  constructor(private prisma: PrismaService) {}

  async getDailyOverview(schoolId: string, dateStr?: string) {
    const today = dateStr ? new Date(dateStr) : new Date();
    today.setHours(0, 0, 0, 0);

    const [substitutions, staffProfiles, attendanceSessions] = await Promise.all([
      this.prisma.teacherSubstitution.findMany({
        where: { schoolId, date: today },
      }),
      this.prisma.staffProfile.findMany({
        where: { schoolId, status: 'ACTIVE' },
      }),
      this.prisma.attendanceSession.findMany({
        where: { schoolId, date: today },
        include: { records: true },
      }),
    ]);

    let totalStudentsMarked = 0;
    let totalPresent = 0;
    let totalAbsent = 0;

    for (const session of attendanceSessions) {
      for (const rec of session.records) {
        totalStudentsMarked++;
        if (rec.status === 'PRESENT') totalPresent++;
        if (rec.status === 'ABSENT') totalAbsent++;
      }
    }

    return {
      date: today,
      totalStaff: staffProfiles.length,
      activeSubstitutions: substitutions.length,
      substitutions,
      attendanceSummary: {
        totalMarked: totalStudentsMarked,
        present: totalPresent,
        absent: totalAbsent,
        attendanceRate: totalStudentsMarked > 0 ? Math.round((totalPresent / totalStudentsMarked) * 100) : 100,
      },
    };
  }

  async createSubstitution(schoolId: string, data: {
    originalTeacherId: string;
    substituteTeacherId: string;
    classId: string;
    sectionId: string;
    periodId: string;
    reason?: string;
    date?: Date;
  }) {
    return this.prisma.teacherSubstitution.create({
      data: {
        schoolId,
        date: data.date ? new Date(data.date) : new Date(),
        originalTeacherId: data.originalTeacherId,
        substituteTeacherId: data.substituteTeacherId,
        classId: data.classId,
        sectionId: data.sectionId,
        periodId: data.periodId,
        reason: data.reason,
      },
    });
  }
}
