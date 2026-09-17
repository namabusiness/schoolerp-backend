import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AcademicsService {
  constructor(private prisma: PrismaService) {}

  // Academic Years
  async getAcademicYears(schoolId: string) {
    return this.prisma.academicYear.findMany({
      where: { schoolId },
      include: { terms: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async createAcademicYear(schoolId: string, data: { name: string; startDate: Date; endDate: Date; isCurrent?: boolean }) {
    if (data.isCurrent) {
      await this.prisma.academicYear.updateMany({
        where: { schoolId, isCurrent: true },
        data: { isCurrent: false },
      });
    }
    return this.prisma.academicYear.create({
      data: {
        schoolId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isCurrent: data.isCurrent ?? true,
      },
    });
  }

  // Classes & Sections
  async getClasses(schoolId: string) {
    return this.prisma.gradeClass.findMany({
      where: { schoolId },
      include: {
        sections: {
          include: {
            _count: { select: { students: true } },
          },
        },
        subjects: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async createClass(schoolId: string, data: { name: string; code: string }) {
    return this.prisma.gradeClass.create({
      data: { schoolId, name: data.name, code: data.code.toUpperCase() },
    });
  }

  async createSection(schoolId: string, classId: string, data: { name: string; capacity?: number }) {
    return this.prisma.section.create({
      data: { schoolId, classId, name: data.name, capacity: data.capacity || 40 },
    });
  }

  // Subjects
  async getSubjects(schoolId: string, classId?: string) {
    const where: any = { schoolId };
    if (classId) where.classId = classId;
    return this.prisma.subject.findMany({
      where,
      include: { gradeClass: true },
    });
  }

  async createSubject(schoolId: string, data: { classId: string; name: string; code: string }) {
    return this.prisma.subject.create({
      data: { schoolId, classId: data.classId, name: data.name, code: data.code.toUpperCase() },
    });
  }

  // Timetable
  async getTimetable(schoolId: string, params: { classId?: string; sectionId?: string; teacherId?: string; roomId?: string }) {
    const where: any = { schoolId };
    if (params.sectionId) where.sectionId = params.sectionId;
    if (params.teacherId) where.teacherId = params.teacherId;
    if (params.roomId) where.roomId = params.roomId;

    return this.prisma.timetableSlot.findMany({
      where,
      include: {
        subject: true,
        period: true,
        room: true,
        section: { include: { gradeClass: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { period: { startTime: 'asc' } }],
    });
  }

  async createTimetableSlot(schoolId: string, data: any) {
    return this.prisma.timetableSlot.create({
      data: {
        schoolId,
        academicYearId: data.academicYearId,
        classId: data.classId,
        sectionId: data.sectionId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        roomId: data.roomId,
        periodId: data.periodId,
        dayOfWeek: Number(data.dayOfWeek),
      },
    });
  }
}
