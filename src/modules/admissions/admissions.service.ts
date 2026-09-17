import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationStatus } from '@prisma/client';

@Injectable()
export class AdmissionsService {
  constructor(private prisma: PrismaService) {}

  // Enquiries
  async getEnquiries(schoolId: string) {
    return this.prisma.enquiry.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createEnquiry(schoolId: string, data: any) {
    return this.prisma.enquiry.create({
      data: {
        schoolId,
        studentName: data.studentName,
        parentName: data.parentName,
        email: data.email,
        phone: data.phone,
        targetGrade: data.targetGrade,
        status: data.status || 'ENQUIRY',
        notes: data.notes,
      },
    });
  }

  async updateEnquiryStatus(id: string, status: string, notes?: string) {
    return this.prisma.enquiry.update({
      where: { id },
      data: { status, notes: notes || undefined },
    });
  }

  // Applications
  async getApplications(schoolId: string, status?: ApplicationStatus) {
    const where: any = { schoolId };
    if (status) where.status = status;
    return this.prisma.admissionApplication.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
    });
  }

  async submitApplication(schoolId: string, data: any) {
    const applicationNo = `APP-${Date.now().toString().slice(-6)}`;
    return this.prisma.admissionApplication.create({
      data: {
        schoolId,
        applicationNo,
        studentName: data.studentName,
        dob: new Date(data.dob),
        gender: data.gender,
        parentName: data.parentName,
        parentPhone: data.parentPhone,
        parentEmail: data.parentEmail,
        address: data.address,
        targetGrade: data.targetGrade,
        status: ApplicationStatus.SUBMITTED,
      },
    });
  }

  async recordInterview(id: string, data: { date: Date; score: number; notes: string }) {
    return this.prisma.admissionApplication.update({
      where: { id },
      data: {
        interviewDate: new Date(data.date),
        interviewScore: data.score,
        interviewNotes: data.notes,
        status: ApplicationStatus.UNDER_REVIEW,
      },
    });
  }

  async decideAdmission(
    id: string,
    decision: 'APPROVED' | 'WAITLISTED' | 'REJECTED',
    enrollmentData?: {
      classId: string;
      sectionId: string;
      academicYearId: string;
      rollNumber?: string;
    },
  ) {
    const app = await this.prisma.admissionApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');

    if (decision === 'APPROVED' && enrollmentData) {
      // Complete enrollment: Create student, parent link, and active status
      return this.prisma.$transaction(async (tx) => {
        const updatedApp = await tx.admissionApplication.update({
          where: { id },
          data: { status: ApplicationStatus.ENROLLED },
        });

        // Create Parent
        const parent = await tx.parentGuardian.create({
          data: {
            schoolId: app.schoolId,
            guardianName: app.parentName,
            phone: app.parentPhone,
            email: app.parentEmail,
            address: app.address,
          },
        });

        // Generate Admission Number
        const admissionNumber = `ADM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const student = await tx.student.create({
          data: {
            schoolId: app.schoolId,
            admissionNumber,
            rollNumber: enrollmentData.rollNumber || '01',
            firstName: app.studentName.split(' ')[0] || app.studentName,
            lastName: app.studentName.split(' ').slice(1).join(' ') || '',
            dob: app.dob,
            gender: app.gender,
            classId: enrollmentData.classId,
            sectionId: enrollmentData.sectionId,
            academicYearId: enrollmentData.academicYearId,
            parentId: parent.id,
            status: 'ACTIVE',
            address: app.address,
          },
        });

        return { application: updatedApp, student };
      });
    }

    return this.prisma.admissionApplication.update({
      where: { id },
      data: { status: decision as ApplicationStatus },
    });
  }
}
