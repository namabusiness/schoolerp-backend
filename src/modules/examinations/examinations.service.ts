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
}
