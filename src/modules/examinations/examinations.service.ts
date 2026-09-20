import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExaminationsService {
  constructor(private prisma: PrismaService) {}

  async getExams(schoolId: string) {
    return this.prisma.exam.findMany({
      where: { schoolId },
      include: {
        academicYear: true,
        schedules: {
          include: { marks: true },
        },
        _count: { select: { reportCards: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async createExam(schoolId: string, data: any) {
    return this.prisma.exam.create({
      data: {
        schoolId,
        academicYearId: data.academicYearId,
        termId: data.termId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isPublished: data.isPublished || false,
      },
    });
  }

  async addExamSchedule(schoolId: string, examId: string, data: any) {
    return this.prisma.examSchedule.create({
      data: {
        schoolId,
        examId,
        classId: data.classId,
        subjectId: data.subjectId,
        examDate: new Date(data.examDate),
        startTime: data.startTime,
        endTime: data.endTime,
        maxMarks: Number(data.maxMarks) || 100,
        passMarks: Number(data.passMarks) || 40,
      },
    });
  }

  // Teacher marks entry
  async submitMarks(
    schoolId: string,
    scheduleId: string,
    marks: { studentId: string; marksObtained: number; remarks?: string }[],
  ) {
    return this.prisma.$transaction(
      marks.map((m) => {
        let grade = 'F';
        const pct = m.marksObtained;
        if (pct >= 90) grade = 'A+';
        else if (pct >= 80) grade = 'A';
        else if (pct >= 70) grade = 'B';
        else if (pct >= 60) grade = 'C';
        else if (pct >= 50) grade = 'D';
        else if (pct >= 40) grade = 'E';

        return this.prisma.examMark.create({
          data: {
            schoolId,
            scheduleId,
            studentId: m.studentId,
            marksObtained: m.marksObtained,
            grade,
            remarks: m.remarks,
          },
        });
      }),
    );
  }

  // Generate Report Cards for an entire class / exam
  async generateReportCards(schoolId: string, examId: string, classId: string) {
    const students = await this.prisma.student.findMany({
      where: { schoolId, classId, status: 'ACTIVE' },
      include: {
        marks: {
          where: { schedule: { examId } },
          include: { schedule: true },
        },
      },
    });

    const reportCards = [];
    for (const student of students) {
      const totalMarks = student.marks.reduce((acc, m) => acc + m.marksObtained, 0);
      const maxPossible = student.marks.reduce((acc, m) => acc + m.schedule.maxMarks, 0);
      const percentage = maxPossible > 0 ? (totalMarks / maxPossible) * 100 : 0;

      let grade = 'F';
      let gpa = 0.0;
      if (percentage >= 90) { grade = 'A+'; gpa = 4.0; }
      else if (percentage >= 80) { grade = 'A'; gpa = 3.7; }
      else if (percentage >= 70) { grade = 'B'; gpa = 3.0; }
      else if (percentage >= 60) { grade = 'C'; gpa = 2.0; }
      else if (percentage >= 50) { grade = 'D'; gpa = 1.0; }

      const rc = await this.prisma.reportCard.create({
        data: {
          schoolId,
          examId,
          studentId: student.id,
          totalMarks,
          percentage: Math.round(percentage * 10) / 10,
          gpa,
          grade,
          isApproved: true,
          isPublished: true,
          teacherRemarks: `Academic performance evaluated: ${grade} standing.`,
        },
      });
      reportCards.push(rc);
    }

    return reportCards;
  }

  async getReportCard(schoolId: string, studentId: string, examId: string) {
    const reportCard = await this.prisma.reportCard.findFirst({
      where: { schoolId, studentId, examId },
      include: {
        student: { include: { gradeClass: true, section: true } },
        exam: true,
      },
    });
    if (!reportCard) throw new NotFoundException('Report card not found');
    return reportCard;
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

  // -------------------------------------------------------------
  // QUESTION PAPERS (Daily/Weekly/Monthly Unit Tests, Quarterly, etc.)
  // -------------------------------------------------------------
  async getQuestionPapers(schoolId: string, params: { classId?: string; subjectId?: string; teacherId?: string; category?: string }) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const where: any = {
      OR: [{ schoolId: resolvedId }, { schoolId }],
    };

    if (params.classId) where.classId = params.classId;
    if (params.subjectId) where.subjectId = params.subjectId;
    if (params.teacherId) where.teacherId = params.teacherId;
    if (params.category) where.examCategory = params.category;

    return this.prisma.questionPaper.findMany({
      where,
      include: {
        gradeClass: true,
        subject: true,
        teacher: { select: { id: true, name: true, employeeCode: true, email: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async createQuestionPaper(schoolId: string, data: any) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.questionPaper.create({
      data: {
        schoolId: resolvedId,
        classId: data.classId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        examCategory: data.examCategory,
        title: data.title,
        description: data.description || null,
        fileUrl: data.fileUrl || '',
        fileName: data.fileName || null,
        fileSize: data.fileSize || null,
        maxMarks: Number(data.maxMarks) || 100,
        durationMinutes: Number(data.durationMinutes) || 90,
        examDate: data.examDate ? new Date(data.examDate) : null,
      },
      include: {
        gradeClass: true,
        subject: true,
        teacher: true,
      },
    });
  }

  async deleteQuestionPaper(schoolId: string, id: string) {
    return this.prisma.questionPaper.delete({
      where: { id },
    });
  }

  // -------------------------------------------------------------
  // CLASS TEACHER ALL-SUBJECTS MARKS ENROLLMENT
  // -------------------------------------------------------------
  async enrollClassMarks(
    schoolId: string,
    data: {
      examName: string;
      classId: string;
      subjectId: string;
      maxMarks?: number;
      passMarks?: number;
      examDate?: string;
      marks: { studentId: string; marksObtained: number; remarks?: string }[];
    },
  ) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const maxMarks = Number(data.maxMarks) || 100;
    const passMarks = Number(data.passMarks) || 40;

    // 1. Get or create academic year
    let academicYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: resolvedId, isCurrent: true },
    });
    if (!academicYear) {
      academicYear = await this.prisma.academicYear.findFirst({
        where: { schoolId: resolvedId },
      });
    }

    // 2. Get or create Exam by name
    let exam = await this.prisma.exam.findFirst({
      where: {
        schoolId: resolvedId,
        name: data.examName,
      },
    });

    if (!exam) {
      exam = await this.prisma.exam.create({
        data: {
          schoolId: resolvedId,
          academicYearId: academicYear?.id || 'ay-2026-2027',
          name: data.examName,
          startDate: data.examDate ? new Date(data.examDate) : new Date(),
          endDate: data.examDate ? new Date(data.examDate) : new Date(),
          isPublished: true,
        },
      });
    }

    // 3. Get or create ExamSchedule for (examId, classId, subjectId)
    let schedule = await this.prisma.examSchedule.findFirst({
      where: {
        schoolId: resolvedId,
        examId: exam.id,
        classId: data.classId,
        subjectId: data.subjectId,
      },
    });

    if (!schedule) {
      schedule = await this.prisma.examSchedule.create({
        data: {
          schoolId: resolvedId,
          examId: exam.id,
          classId: data.classId,
          subjectId: data.subjectId,
          examDate: data.examDate ? new Date(data.examDate) : new Date(),
          startTime: '09:30',
          endTime: '12:30',
          maxMarks,
          passMarks,
        },
      });
    } else {
      schedule = await this.prisma.examSchedule.update({
        where: { id: schedule.id },
        data: { maxMarks, passMarks },
      });
    }

    // 4. Enroll / Upsert marks for each student
    const results = [];
    for (const m of data.marks) {
      const percentage = maxMarks > 0 ? (m.marksObtained / maxMarks) * 100 : 0;
      let grade = 'F';
      if (percentage >= 90) grade = 'A+';
      else if (percentage >= 80) grade = 'A';
      else if (percentage >= 70) grade = 'B';
      else if (percentage >= 60) grade = 'C';
      else if (percentage >= 50) grade = 'D';
      else if (percentage >= passMarks) grade = 'E';

      // Find existing mark
      const existing = await this.prisma.examMark.findFirst({
        where: {
          scheduleId: schedule.id,
          studentId: m.studentId,
        },
      });

      if (existing) {
        const updated = await this.prisma.examMark.update({
          where: { id: existing.id },
          data: {
            marksObtained: Number(m.marksObtained),
            grade,
            remarks: m.remarks || null,
          },
        });
        results.push(updated);
      } else {
        const created = await this.prisma.examMark.create({
          data: {
            schoolId: resolvedId,
            scheduleId: schedule.id,
            studentId: m.studentId,
            marksObtained: Number(m.marksObtained),
            grade,
            remarks: m.remarks || null,
          },
        });
        results.push(created);
      }
    }

    return {
      exam,
      schedule,
      marks: results,
    };
  }
}

