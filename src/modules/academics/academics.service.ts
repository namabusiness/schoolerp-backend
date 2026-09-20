import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AcademicsService {
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

    const byPrefix = await this.prisma.school.findUnique({ where: { id: `school-${schoolId}` } });
    if (byPrefix) return byPrefix.id;

    const fallback = await this.prisma.school.findFirst();
    return fallback?.id || 'school-greenwood-high';
  }

  // -------------------------------------------------------------
  // ACADEMIC YEARS
  // -------------------------------------------------------------
  async getAcademicYears(schoolId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.academicYear.findMany({
      where: {
        OR: [{ schoolId: resolvedId }, { schoolId }],
      },
      include: { terms: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async createAcademicYear(
    schoolId: string,
    data: { name: string; startDate: Date; endDate: Date; isCurrent?: boolean },
  ) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    if (data.isCurrent) {
      await this.prisma.academicYear.updateMany({
        where: {
          OR: [{ schoolId: resolvedId }, { schoolId }],
          isCurrent: true,
        },
        data: { isCurrent: false },
      });
    }
    return this.prisma.academicYear.create({
      data: {
        schoolId: resolvedId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isCurrent: data.isCurrent ?? true,
      },
    });
  }

  // -------------------------------------------------------------
  // CLASSES & SECTIONS
  // -------------------------------------------------------------
  async getClasses(schoolId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.gradeClass.findMany({
      where: {
        OR: [{ schoolId: resolvedId }, { schoolId }],
      },
      include: {
        classTeacher: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            designation: true,
            employeeCode: true,
            photoUrl: true,
          },
        },
        sections: {
          include: {
            classTeacher: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                designation: true,
                employeeCode: true,
                photoUrl: true,
              },
            },
            _count: { select: { students: true } },
          },
          orderBy: { name: 'asc' },
        },
        subjects: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                designation: true,
                employeeCode: true,
                photoUrl: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createClass(
    schoolId: string,
    data: { name: string; code: string; classTeacherId?: string; initialSections?: string[] },
  ) {
    const resolvedId = await this.resolveSchoolId(schoolId);

    // Validate class teacher exclusivity if provided
    if (data.classTeacherId && data.classTeacherId !== 'NONE') {
      await this.validateTeacherExclusivity(resolvedId, data.classTeacherId);
    }

    const grade = await this.prisma.gradeClass.create({
      data: {
        schoolId: resolvedId,
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        classTeacherId: data.classTeacherId && data.classTeacherId !== 'NONE' ? data.classTeacherId : null,
      },
    });

    // Create initial sections (e.g. Section A, Section B)
    const sectionsToCreate =
      data.initialSections && data.initialSections.length > 0
        ? data.initialSections
        : ['Section A'];

    for (const secName of sectionsToCreate) {
      await this.prisma.section.create({
        data: {
          schoolId: resolvedId,
          classId: grade.id,
          name: secName.trim(),
          capacity: 40,
        },
      });
    }

    return this.prisma.gradeClass.findUnique({
      where: { id: grade.id },
      include: {
        classTeacher: true,
        sections: {
          include: {
            classTeacher: true,
            _count: { select: { students: true } },
          },
        },
        subjects: {
          include: { teacher: true },
        },
        _count: { select: { students: true } },
      },
    });
  }

  async deleteClass(schoolId: string, classId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const studentCount = await this.prisma.student.count({
      where: {
        classId,
        OR: [{ schoolId: resolvedId }, { schoolId }],
      },
    });

    if (studentCount > 0) {
      throw new BadRequestException(
        `Cannot delete class because ${studentCount} students are currently enrolled. Reassign or transfer students first.`,
      );
    }

    await this.prisma.section.deleteMany({ where: { classId } });
    await this.prisma.subject.deleteMany({ where: { classId } });
    return this.prisma.gradeClass.delete({ where: { id: classId } });
  }

  async createSection(
    schoolId: string,
    classId: string,
    data: { name: string; capacity?: number; classTeacherId?: string },
  ) {
    const resolvedId = await this.resolveSchoolId(schoolId);

    if (data.classTeacherId && data.classTeacherId !== 'NONE') {
      await this.validateTeacherExclusivity(resolvedId, data.classTeacherId);
    }

    return this.prisma.section.create({
      data: {
        schoolId: resolvedId,
        classId,
        name: data.name.trim(),
        capacity: Number(data.capacity) || 40,
        classTeacherId: data.classTeacherId && data.classTeacherId !== 'NONE' ? data.classTeacherId : null,
      },
      include: {
        classTeacher: true,
        _count: { select: { students: true } },
      },
    });
  }

  async deleteSection(schoolId: string, sectionId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const studentCount = await this.prisma.student.count({
      where: {
        sectionId,
        OR: [{ schoolId: resolvedId }, { schoolId }],
      },
    });

    if (studentCount > 0) {
      throw new BadRequestException(
        `Cannot delete section because ${studentCount} students are currently assigned to it. Reassign students first.`,
      );
    }

    return this.prisma.section.delete({ where: { id: sectionId } });
  }

  // -------------------------------------------------------------
  // TEACHER EXCLUSIVITY & ASSIGNMENTS
  // -------------------------------------------------------------
  private async validateTeacherExclusivity(
    schoolId: string,
    teacherId: string,
    excludeClassId?: string,
    excludeSectionId?: string,
  ) {
    // 1. Check if teacher is already assigned as Class Teacher for another Grade
    const existingClass = await this.prisma.gradeClass.findFirst({
      where: {
        classTeacherId: teacherId,
        ...(excludeClassId ? { id: { not: excludeClassId } } : {}),
        OR: [{ schoolId }, { schoolId: schoolId.replace('school-', '') }],
      },
    });

    if (existingClass) {
      throw new BadRequestException(
        `Faculty member is already designated as Class Teacher for "${existingClass.name}". A teacher cannot be assigned as class teacher to multiple classes.`,
      );
    }

    // 2. Check if teacher is already assigned as Section Class Teacher
    const existingSection = await this.prisma.section.findFirst({
      where: {
        classTeacherId: teacherId,
        ...(excludeSectionId ? { id: { not: excludeSectionId } } : {}),
        OR: [{ schoolId }, { schoolId: schoolId.replace('school-', '') }],
      },
      include: { gradeClass: true },
    });

    if (existingSection) {
      throw new BadRequestException(
        `Faculty member is already designated as Class Teacher for "${existingSection.gradeClass?.name} - ${existingSection.name}".`,
      );
    }
  }

  async assignClassTeacher(schoolId: string, classId: string, teacherId: string | null) {
    const resolvedId = await this.resolveSchoolId(schoolId);

    if (teacherId && teacherId !== 'NONE') {
      await this.validateTeacherExclusivity(resolvedId, teacherId, classId);
    }

    return this.prisma.gradeClass.update({
      where: { id: classId },
      data: { classTeacherId: teacherId && teacherId !== 'NONE' ? teacherId : null },
      include: {
        classTeacher: true,
        sections: { include: { classTeacher: true } },
      },
    });
  }

  async assignSectionTeacher(schoolId: string, sectionId: string, teacherId: string | null) {
    const resolvedId = await this.resolveSchoolId(schoolId);

    if (teacherId && teacherId !== 'NONE') {
      await this.validateTeacherExclusivity(resolvedId, teacherId, undefined, sectionId);
    }

    return this.prisma.section.update({
      where: { id: sectionId },
      data: { classTeacherId: teacherId && teacherId !== 'NONE' ? teacherId : null },
      include: {
        classTeacher: true,
        gradeClass: true,
      },
    });
  }

  // -------------------------------------------------------------
  // STUDENT ENROLLMENT & EXCLUSIVITY
  // -------------------------------------------------------------
  async getUnassignedStudents(schoolId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.student.findMany({
      where: {
        OR: [
          { classId: null },
          { sectionId: null },
        ],
        AND: [
          { OR: [{ schoolId: resolvedId }, { schoolId }] },
          { status: 'ACTIVE' },
        ],
      },
      include: {
        parent: true,
      },
      orderBy: [{ firstName: 'asc' }, { admissionNumber: 'asc' }],
    });
  }

  async unassignStudentFromClass(schoolId: string, studentId: string) {
    await this.resolveSchoolId(schoolId);
    return this.prisma.student.update({
      where: { id: studentId },
      data: {
        classId: null,
        sectionId: null,
        rollNumber: null,
      },
      include: {
        parent: true,
      },
    });
  }

  async assignStudentToClass(
    schoolId: string,
    data: { studentId: string; classId: string; sectionId: string; rollNumber?: string },
  ) {
    await this.resolveSchoolId(schoolId);
    return this.prisma.student.update({
      where: { id: data.studentId },
      data: {
        classId: data.classId,
        sectionId: data.sectionId,
        ...(data.rollNumber !== undefined ? { rollNumber: data.rollNumber } : {}),
      },
      include: {
        gradeClass: true,
        section: true,
        parent: true,
      },
    });
  }

  // -------------------------------------------------------------
  // CLASS STUDENTS ROSTER
  // -------------------------------------------------------------
  async getClassStudents(schoolId: string, classId: string, sectionId?: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const where: any = {
      classId,
      OR: [{ schoolId: resolvedId }, { schoolId }],
    };
    if (sectionId && sectionId !== 'ALL') {
      where.sectionId = sectionId;
    }

    const [classInfo, sectionInfo, students] = await Promise.all([
      this.prisma.gradeClass.findUnique({
        where: { id: classId },
        include: {
          classTeacher: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              designation: true,
              employeeCode: true,
              qualification: true,
              specialization: true,
              photoUrl: true,
            },
          },
          sections: {
            include: {
              classTeacher: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  designation: true,
                  employeeCode: true,
                  qualification: true,
                  specialization: true,
                  photoUrl: true,
                },
              },
              _count: { select: { students: true } },
            },
            orderBy: { name: 'asc' },
          },
          subjects: {
            include: {
              teacher: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  designation: true,
                  employeeCode: true,
                  photoUrl: true,
                },
              },
            },
            orderBy: { name: 'asc' },
          },
        },
      }),
      sectionId && sectionId !== 'ALL'
        ? this.prisma.section.findUnique({
            where: { id: sectionId },
            include: {
              classTeacher: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  designation: true,
                  employeeCode: true,
                  qualification: true,
                  specialization: true,
                  photoUrl: true,
                },
              },
            },
          })
        : null,
      this.prisma.student.findMany({
        where,
        include: {
          gradeClass: true,
          section: true,
          parent: true,
        },
        orderBy: [{ rollNumber: 'asc' }, { firstName: 'asc' }],
      }),
    ]);

    // Active class teacher resolution:
    const activeTeacher = sectionInfo?.classTeacher || classInfo?.classTeacher || null;

    return {
      class: classInfo,
      section: sectionInfo,
      classTeacher: activeTeacher,
      subjects: classInfo?.subjects || [],
      students,
      totalCount: students.length,
    };
  }

  // -------------------------------------------------------------
  // SUBJECT-WISE TEACHERS & CURRICULUM
  // -------------------------------------------------------------
  async getSubjects(schoolId: string, classId?: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const where: any = {
      OR: [{ schoolId: resolvedId }, { schoolId }],
    };
    if (classId) where.classId = classId;
    return this.prisma.subject.findMany({
      where,
      include: {
        gradeClass: true,
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            designation: true,
            employeeCode: true,
            photoUrl: true,
          },
        },
      },
      orderBy: [{ gradeClass: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async createSubject(
    schoolId: string,
    data: { classId: string; name: string; code: string; teacherId?: string; periodsPerWeek?: number },
  ) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.subject.create({
      data: {
        schoolId: resolvedId,
        classId: data.classId,
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        teacherId: data.teacherId && data.teacherId !== 'NONE' ? data.teacherId : null,
        periodsPerWeek: Number(data.periodsPerWeek) || 4,
      },
      include: {
        teacher: true,
        gradeClass: true,
      },
    });
  }

  async assignSubjectTeacher(schoolId: string, subjectId: string, teacherId: string | null) {
    await this.resolveSchoolId(schoolId);
    return this.prisma.subject.update({
      where: { id: subjectId },
      data: { teacherId: teacherId && teacherId !== 'NONE' ? teacherId : null },
      include: {
        teacher: true,
        gradeClass: true,
      },
    });
  }

  async deleteSubject(schoolId: string, subjectId: string) {
    await this.resolveSchoolId(schoolId);
    return this.prisma.subject.delete({ where: { id: subjectId } });
  }

  // -------------------------------------------------------------
  // TIMETABLE & SCHEDULING ENGINE
  // -------------------------------------------------------------
  async getTimetable(
    schoolId: string,
    params: { classId?: string; sectionId?: string; teacherId?: string; status?: string },
  ) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const where: any = {
      OR: [{ schoolId: resolvedId }, { schoolId }],
    };
    if (params.classId) where.classId = params.classId;
    if (params.sectionId && params.sectionId !== 'ALL') where.sectionId = params.sectionId;
    if (params.teacherId) where.teacherId = params.teacherId;
    if (params.status) where.status = params.status;

    const [slots, periods, classInfo, sectionInfo] = await Promise.all([
      this.prisma.timetableSlot.findMany({
        where,
        include: {
          subject: true,
          teacher: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              designation: true,
              employeeCode: true,
              photoUrl: true,
            },
          },
          period: true,
          section: {
            include: {
              gradeClass: true,
            },
          },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { period: { periodNumber: 'asc' } }],
      }),
      this.prisma.period.findMany({
        where: {
          OR: [{ schoolId: resolvedId }, { schoolId }],
        },
        orderBy: { periodNumber: 'asc' },
      }),
      params.classId
        ? this.prisma.gradeClass.findUnique({
            where: { id: params.classId },
            include: {
              sections: true,
              subjects: {
                include: { teacher: true },
              },
            },
          })
        : null,
      params.sectionId && params.sectionId !== 'ALL'
        ? this.prisma.section.findUnique({
            where: { id: params.sectionId },
            include: { classTeacher: true },
          })
        : null,
    ]);

    return {
      slots,
      periods,
      class: classInfo,
      section: sectionInfo,
      totalSlots: slots.length,
      approvedCount: slots.filter((s) => s.status === 'APPROVED').length,
      draftCount: slots.filter((s) => s.status === 'DRAFT').length,
    };
  }

  async generateTimetable(
    schoolId: string,
    data: {
      classId: string;
      sectionId?: string;
      periodsPerDay?: number;
      daysCount?: number;
      startTime?: string;
      periodDurationMinutes?: number;
      breakAfterPeriod?: number;
      breakDurationMinutes?: number;
      lunchAfterPeriod?: number;
      lunchDurationMinutes?: number;
      subjectAllocations: Array<{
        subjectId: string;
        teacherId?: string;
        periodsPerWeek: number;
      }>;
      includePT?: boolean;
      ptTeacherId?: string;
      includeLibrary?: boolean;
      libraryTeacherId?: string;
    },
  ) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const periodsPerDay = Number(data.periodsPerDay) || 7;
    const daysCount = Number(data.daysCount) || 5; // 5 = Mon-Fri, 6 = Mon-Sat
    const startTimeStr = data.startTime || '08:30';
    const periodDuration = Number(data.periodDurationMinutes) || 45;
    const breakAfter = Number(data.breakAfterPeriod) || 2;
    const breakDuration = Number(data.breakDurationMinutes) || 20;
    const lunchAfter = Number(data.lunchAfterPeriod) || 4;
    const lunchDuration = Number(data.lunchDurationMinutes) || 40;

    // 1. Resolve Target Section
    let targetSectionId = data.sectionId;
    if (!targetSectionId || targetSectionId === 'ALL') {
      const firstSec = await this.prisma.section.findFirst({
        where: { classId: data.classId },
        orderBy: { name: 'asc' },
      });
      if (!firstSec) {
        throw new BadRequestException('Cannot generate timetable: Grade has no sections configured.');
      }
      targetSectionId = firstSec.id;
    }

    // 2. Generate or Upsert Standard Periods for the School
    // Helper to add minutes to "HH:MM"
    const addMinutes = (time: string, mins: number): string => {
      const [h, m] = time.split(':').map(Number);
      const date = new Date();
      date.setHours(h, m, 0, 0);
      date.setMinutes(date.getMinutes() + mins);
      const resH = String(date.getHours()).padStart(2, '0');
      const resM = String(date.getMinutes()).padStart(2, '0');
      return `${resH}:${resM}`;
    };

    let currentCursorTime = startTimeStr;
    const periodRecords: any[] = [];

    for (let pNum = 1; pNum <= periodsPerDay; pNum++) {
      const pStart = currentCursorTime;
      const pEnd = addMinutes(pStart, periodDuration);
      currentCursorTime = pEnd;

      // Find or create standard period
      let period = await this.prisma.period.findFirst({
        where: {
          periodNumber: pNum,
          OR: [{ schoolId: resolvedId }, { schoolId }],
        },
      });

      if (period) {
        period = await this.prisma.period.update({
          where: { id: period.id },
          data: {
            name: `Period ${pNum}`,
            startTime: pStart,
            endTime: pEnd,
            isBreak: false,
          },
        });
      } else {
        period = await this.prisma.period.create({
          data: {
            schoolId: resolvedId,
            name: `Period ${pNum}`,
            periodNumber: pNum,
            startTime: pStart,
            endTime: pEnd,
            isBreak: false,
          },
        });
      }
      periodRecords.push(period);

      // Handle breaks
      if (pNum === breakAfter) {
        currentCursorTime = addMinutes(currentCursorTime, breakDuration);
      } else if (pNum === lunchAfter) {
        currentCursorTime = addMinutes(currentCursorTime, lunchDuration);
      }
    }

    // 3. Ensure PT & Library Subjects exist for this Grade
    let ptSubject = await this.prisma.subject.findFirst({
      where: {
        classId: data.classId,
        OR: [
          { name: { contains: 'Physical Education', mode: 'insensitive' } },
          { name: { contains: 'PT', mode: 'insensitive' } },
          { code: { contains: 'PE', mode: 'insensitive' } },
        ],
      },
    });
    if (!ptSubject && data.includePT !== false) {
      ptSubject = await this.prisma.subject.create({
        data: {
          schoolId: resolvedId,
          classId: data.classId,
          name: 'Physical Education (PT)',
          code: 'PE101',
          periodsPerWeek: 1,
          teacherId: data.ptTeacherId || undefined,
        },
      });
    }

    let librarySubject = await this.prisma.subject.findFirst({
      where: {
        classId: data.classId,
        OR: [
          { name: { contains: 'Library', mode: 'insensitive' } },
          { code: { contains: 'LIB', mode: 'insensitive' } },
        ],
      },
    });
    if (!librarySubject && data.includeLibrary !== false) {
      librarySubject = await this.prisma.subject.create({
        data: {
          schoolId: resolvedId,
          classId: data.classId,
          name: 'Library & Reading',
          code: 'LIB101',
          periodsPerWeek: 1,
          teacherId: data.libraryTeacherId || undefined,
        },
      });
    }

    // 4. Index Teacher Busy Slots across other classes in the school
    // Rule: "if a teacher is assigned for a period for grade 10 and same teacher handles subjects for other grade the timetable should be flexible for them"
    const otherClassSlots = await this.prisma.timetableSlot.findMany({
      where: {
        OR: [{ schoolId: resolvedId }, { schoolId }],
        sectionId: { not: targetSectionId },
      },
      include: { period: true },
    });

    const busyTeacherMap = new Set<string>();
    for (const slot of otherClassSlots) {
      if (slot.teacherId && slot.period) {
        // key format: "teacherId-day-periodNumber"
        busyTeacherMap.add(`${slot.teacherId}-${slot.dayOfWeek}-${slot.period.periodNumber}`);
      }
    }

    // 5. Build Subject Period Tokens
    type SubjectToken = {
      subjectId: string;
      teacherId?: string | null;
      name: string;
      code: string;
      isPT?: boolean;
      isLibrary?: boolean;
    };

    const tokens: SubjectToken[] = [];

    // Academic subjects from allocation
    for (const alloc of data.subjectAllocations || []) {
      const sub = await this.prisma.subject.findUnique({ where: { id: alloc.subjectId } });
      if (!sub) continue;
      if (ptSubject && sub.id === ptSubject.id) continue;
      if (librarySubject && sub.id === librarySubject.id) continue;
      const count = Math.max(1, Number(alloc.periodsPerWeek) || 1);
      const teacherId = alloc.teacherId && alloc.teacherId !== 'NONE' ? alloc.teacherId : sub.teacherId;
      for (let i = 0; i < count; i++) {
        tokens.push({
          subjectId: sub.id,
          teacherId,
          name: sub.name,
          code: sub.code,
        });
      }
    }

    // Mandatory: Exactly 1 PT period per week
    if (ptSubject && data.includePT !== false) {
      tokens.push({
        subjectId: ptSubject.id,
        teacherId: data.ptTeacherId || ptSubject.teacherId,
        name: ptSubject.name,
        code: ptSubject.code,
        isPT: true,
      });
    }

    // Mandatory: Exactly 1 Library period per week
    if (librarySubject && data.includeLibrary !== false) {
      tokens.push({
        subjectId: librarySubject.id,
        teacherId: data.libraryTeacherId || librarySubject.teacherId,
        name: librarySubject.name,
        code: librarySubject.code,
        isLibrary: true,
      });
    }

    const totalAvailableSlots = daysCount * periodsPerDay;

    // Pad tokens if less than available slots
    if (tokens.length < totalAvailableSlots && tokens.length > 0) {
      let padIdx = 0;
      const initialTokenCount = tokens.length;
      while (tokens.length < totalAvailableSlots) {
        const base = tokens[padIdx % initialTokenCount];
        // Do not pad PT or Library (keep them at 1 per week)
        if (!base.isPT && !base.isLibrary) {
          tokens.push({ ...base });
        }
        padIdx++;
      }
    }

    // 6. Conflict-Free Timetable Grid Allocation
    // Grid: grid[dayIndex 1..daysCount][pNum 1..periodsPerDay]
    const grid: Record<number, Record<number, SubjectToken | null>> = {};
    for (let d = 1; d <= daysCount; d++) {
      grid[d] = {};
      for (let p = 1; p <= periodsPerDay; p++) {
        grid[d][p] = null;
      }
    }

    // Track subject counts per day to maintain balanced distribution
    const subjectDayCounts: Record<string, Record<number, number>> = {};
    const incrementSubjectDay = (subId: string, day: number) => {
      if (!subjectDayCounts[subId]) subjectDayCounts[subId] = {};
      subjectDayCounts[subId][day] = (subjectDayCounts[subId][day] || 0) + 1;
    };

    // A. Place PT period (Day 4 or 5, afternoon period e.g. 5 or 6, not period 1 or lunch)
    const ptTokenIndex = tokens.findIndex((t) => t.isPT);
    if (ptTokenIndex !== -1) {
      const ptToken = tokens.splice(ptTokenIndex, 1)[0];
      let placed = false;
      const preferredDays = [5, 4, 3, 2, 1];
      const preferredPeriods = [periodsPerDay - 1, periodsPerDay, periodsPerDay - 2, 2, 3];

      for (const d of preferredDays) {
        if (d > daysCount || placed) continue;
        for (const p of preferredPeriods) {
          if (p > periodsPerDay || p <= 0) continue;
          const isTeacherBusy =
            ptToken.teacherId && busyTeacherMap.has(`${ptToken.teacherId}-${d}-${p}`);
          if (!grid[d][p] && !isTeacherBusy) {
            grid[d][p] = ptToken;
            incrementSubjectDay(ptToken.subjectId, d);
            if (ptToken.teacherId) busyTeacherMap.add(`${ptToken.teacherId}-${d}-${p}`);
            placed = true;
            break;
          }
        }
      }
      if (!placed && daysCount >= 1) {
        grid[1][periodsPerDay] = ptToken;
      }
    }

    // B. Place Library period (Day 2 or 3, mid-morning/afternoon)
    const libTokenIndex = tokens.findIndex((t) => t.isLibrary);
    if (libTokenIndex !== -1) {
      const libToken = tokens.splice(libTokenIndex, 1)[0];
      let placed = false;
      const preferredDays = [2, 3, 4, 1, 5];
      const preferredPeriods = [3, 4, 2, 5, 1];

      for (const d of preferredDays) {
        if (d > daysCount || placed) continue;
        for (const p of preferredPeriods) {
          if (p > periodsPerDay || p <= 0) continue;
          const isTeacherBusy =
            libToken.teacherId && busyTeacherMap.has(`${libToken.teacherId}-${d}-${p}`);
          if (!grid[d][p] && !isTeacherBusy) {
            grid[d][p] = libToken;
            incrementSubjectDay(libToken.subjectId, d);
            if (libToken.teacherId) busyTeacherMap.add(`${libToken.teacherId}-${d}-${p}`);
            placed = true;
            break;
          }
        }
      }
      if (!placed && daysCount >= 1) {
        grid[daysCount][1] = libToken;
      }
    }

    // C. Distribute Academic Subjects evenly without teacher conflicts
    // Group remaining tokens by subjectId
    const subjectTokenBuckets: Record<string, SubjectToken[]> = {};
    for (const tok of tokens) {
      if (!subjectTokenBuckets[tok.subjectId]) subjectTokenBuckets[tok.subjectId] = [];
      subjectTokenBuckets[tok.subjectId].push(tok);
    }

    // Sort subjects by count descending
    const sortedSubjectIds = Object.keys(subjectTokenBuckets).sort(
      (a, b) => subjectTokenBuckets[b].length - subjectTokenBuckets[a].length,
    );

    for (const subId of sortedSubjectIds) {
      const bucket = subjectTokenBuckets[subId];
      while (bucket.length > 0) {
        const token = bucket.pop()!;
        let bestDay = -1;
        let bestPeriod = -1;
        let minCountOnDay = 999;

        // Try to find a day with fewest periods of this subject
        for (let d = 1; d <= daysCount; d++) {
          const currentCount = subjectDayCounts[subId]?.[d] || 0;
          if (currentCount >= minCountOnDay) continue;

          // Check if day has an available period without teacher conflict
          for (let p = 1; p <= periodsPerDay; p++) {
            if (grid[d][p] !== null) continue;
            const isTeacherBusy =
              token.teacherId && busyTeacherMap.has(`${token.teacherId}-${d}-${p}`);
            if (!isTeacherBusy) {
              minCountOnDay = currentCount;
              bestDay = d;
              bestPeriod = p;
              break;
            }
          }
        }

        // Fallback: if no conflict-free optimal slot found, find ANY open slot
        if (bestDay === -1) {
          for (let d = 1; d <= daysCount; d++) {
            for (let p = 1; p <= periodsPerDay; p++) {
              if (grid[d][p] === null) {
                bestDay = d;
                bestPeriod = p;
                break;
              }
            }
            if (bestDay !== -1) break;
          }
        }

        if (bestDay !== -1 && bestPeriod !== -1) {
          grid[bestDay][bestPeriod] = token;
          incrementSubjectDay(subId, bestDay);
          if (token.teacherId) busyTeacherMap.add(`${token.teacherId}-${bestDay}-${bestPeriod}`);
        }
      }
    }

    // 7. Persist Draft Slots
    // Clear existing slots for this class and section
    await this.prisma.timetableSlot.deleteMany({
      where: {
        classId: data.classId,
        sectionId: targetSectionId,
      },
    });

    const slotsToCreate: any[] = [];
    for (let d = 1; d <= daysCount; d++) {
      for (let p = 1; p <= periodsPerDay; p++) {
        const token = grid[d][p];
        const periodRec = periodRecords[p - 1];
        if (!token || !periodRec) continue;

        slotsToCreate.push({
          schoolId: resolvedId,
          classId: data.classId,
          sectionId: targetSectionId,
          subjectId: token.subjectId,
          teacherId: token.teacherId && token.teacherId !== 'NONE' ? token.teacherId : null,
          periodId: periodRec.id,
          dayOfWeek: d,
          status: 'DRAFT',
          customNote: token.isPT ? 'Physical Education (PT)' : token.isLibrary ? 'Library & Reading' : null,
        });
      }
    }

    // Batch create slots
    for (const slotData of slotsToCreate) {
      await this.prisma.timetableSlot.create({ data: slotData });
    }

    return this.getTimetable(resolvedId, {
      classId: data.classId,
      sectionId: targetSectionId,
    });
  }

  async approveTimetable(schoolId: string, classId: string, sectionId?: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const where: any = {
      classId,
      OR: [{ schoolId: resolvedId }, { schoolId }],
    };
    if (sectionId && sectionId !== 'ALL') {
      where.sectionId = sectionId;
    }

    const updated = await this.prisma.timetableSlot.updateMany({
      where,
      data: { status: 'APPROVED' },
    });

    return {
      message: 'Timetable approved and published successfully.',
      approvedCount: updated.count,
    };
  }

  async getFacultyTimetable(schoolId: string, teacherId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const [teacher, slots, periods] = await Promise.all([
      this.prisma.staffProfile.findUnique({
        where: { id: teacherId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          designation: true,
          employeeCode: true,
          photoUrl: true,
          qualification: true,
          specialization: true,
        },
      }),
      this.prisma.timetableSlot.findMany({
        where: {
          teacherId,
          OR: [{ schoolId: resolvedId }, { schoolId }],
        },
        include: {
          subject: true,
          period: true,
          section: {
            include: {
              gradeClass: true,
            },
          },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { period: { periodNumber: 'asc' } }],
      }),
      this.prisma.period.findMany({
        where: {
          OR: [{ schoolId: resolvedId }, { schoolId }],
        },
        orderBy: { periodNumber: 'asc' },
      }),
    ]);

    return {
      teacher,
      slots,
      periods,
      totalPeriodsPerWeek: slots.length,
    };
  }

  async updateTimetableSlot(
    schoolId: string,
    slotId: string,
    data: { subjectId?: string; teacherId?: string; customNote?: string },
  ) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const existing = await this.prisma.timetableSlot.findUnique({
      where: { id: slotId },
      include: { period: true },
    });
    if (!existing) {
      throw new NotFoundException('Timetable slot not found');
    }

    // Check teacher conflict if changing teacher
    if (data.teacherId && data.teacherId !== existing.teacherId && data.teacherId !== 'NONE') {
      const conflict = await this.prisma.timetableSlot.findFirst({
        where: {
          teacherId: data.teacherId,
          dayOfWeek: existing.dayOfWeek,
          periodId: existing.periodId,
          id: { not: slotId },
          OR: [{ schoolId: resolvedId }, { schoolId }],
        },
        include: {
          section: { include: { gradeClass: true } },
          subject: true,
        },
      });

      if (conflict) {
        const clsName = conflict.section?.gradeClass?.name || 'another class';
        const secName = conflict.section?.name || '';
        throw new BadRequestException(
          `Teacher Conflict: This faculty member is already scheduled to teach "${conflict.subject?.name}" in ${clsName} (${secName}) on Day ${existing.dayOfWeek}, ${existing.period?.name || 'this period'}.`,
        );
      }
    }

    return this.prisma.timetableSlot.update({
      where: { id: slotId },
      data: {
        ...(data.subjectId ? { subjectId: data.subjectId } : {}),
        teacherId: data.teacherId && data.teacherId !== 'NONE' ? data.teacherId : null,
        ...(data.customNote !== undefined ? { customNote: data.customNote } : {}),
      },
      include: {
        subject: true,
        teacher: true,
        period: true,
        section: { include: { gradeClass: true } },
      },
    });
  }

  async deleteClassTimetable(schoolId: string, classId: string, sectionId?: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const where: any = {
      classId,
      OR: [{ schoolId: resolvedId }, { schoolId }],
    };
    if (sectionId && sectionId !== 'ALL') {
      where.sectionId = sectionId;
    }
    const deleted = await this.prisma.timetableSlot.deleteMany({ where });
    return { message: 'Timetable cleared', count: deleted.count };
  }

  async createTimetableSlot(schoolId: string, data: any) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.timetableSlot.create({
      data: {
        schoolId: resolvedId,
        academicYearId: data.academicYearId || undefined,
        classId: data.classId,
        sectionId: data.sectionId,
        subjectId: data.subjectId,
        teacherId: data.teacherId && data.teacherId !== 'NONE' ? data.teacherId : null,
        roomId: data.roomId || undefined,
        periodId: data.periodId,
        dayOfWeek: Number(data.dayOfWeek),
        status: data.status || 'DRAFT',
        customNote: data.customNote || null,
      },
    });
  }
}

