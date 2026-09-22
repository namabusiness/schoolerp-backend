import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HomeworkService {
  constructor(private prisma: PrismaService) {}

  async getHomeworks(schoolId: string, params: { classId?: string; sectionId?: string; subjectId?: string }) {
    const where: any = { schoolId };
    if (params.classId) where.classId = params.classId;
    if (params.sectionId) where.sectionId = params.sectionId;
    if (params.subjectId) where.subjectId = params.subjectId;

    return this.prisma.homework.findMany({
      where,
      include: {
        subject: true,
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: 'desc' },
    });
  }

  async getHomeworkById(schoolId: string, id: string) {
    const homework = await this.prisma.homework.findFirst({
      where: { id, schoolId },
      include: {
        subject: true,
        submissions: {
          include: { student: true },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });
    if (!homework) throw new NotFoundException('Homework not found');
    return homework;
  }

  async createHomework(schoolId: string, data: any) {
    return this.prisma.homework.create({
      data: {
        schoolId,
        classId: data.classId,
        sectionId: data.sectionId,
        subjectId: data.subjectId,
        teacherId: data.teacherId || 'teacher-default',
        title: data.title,
        description: data.description,
        attachmentUrl: data.attachmentUrl,
        dueDate: new Date(data.dueDate),
      },
    });
  }

  async getSubmissions(schoolId: string, homeworkId: string) {
    return this.prisma.homeworkSubmission.findMany({
      where: { homeworkId, schoolId },
      include: {
        student: {
          include: { gradeClass: true, section: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async submitHomework(schoolId: string, homeworkId: string, data: any) {
    const existing = await this.prisma.homeworkSubmission.findFirst({
      where: { schoolId, homeworkId, studentId: data.studentId },
    });

    if (existing) {
      return this.prisma.homeworkSubmission.update({
        where: { id: existing.id },
        data: {
          submissionText: data.submissionText,
          attachmentUrl: data.attachmentUrl,
          submittedByRole: data.submittedByRole || 'STUDENT',
          submittedAt: new Date(),
          status: 'PENDING',
        },
      });
    }

    return this.prisma.homeworkSubmission.create({
      data: {
        schoolId,
        homeworkId,
        studentId: data.studentId,
        submissionText: data.submissionText,
        attachmentUrl: data.attachmentUrl,
        submittedByRole: data.submittedByRole || 'STUDENT',
        status: 'PENDING',
      },
    });
  }

  async gradeSubmission(
    schoolId: string,
    submissionId: string,
    data: { grade: string; feedback: string; allowResubmit?: boolean },
  ) {
    return this.prisma.homeworkSubmission.update({
      where: { id: submissionId, schoolId },
      data: {
        grade: data.grade,
        feedback: data.feedback,
        allowResubmit: !!data.allowResubmit,
        status: data.allowResubmit ? 'RESUBMISSION_ALLOWED' : 'REVIEWED',
      },
    });
  }
}

