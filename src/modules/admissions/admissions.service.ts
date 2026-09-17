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

  async getApplicationById(id: string) {
    const app = await this.prisma.admissionApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async submitApplication(schoolId: string, data: any) {
    const applicationNo = `APP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    
    // Normalize strings for JSON fields if passed as objects
    const tenthMarksData = typeof data.tenthMarksData === 'object' 
      ? JSON.stringify(data.tenthMarksData) 
      : data.tenthMarksData || null;

    const eleventhMarksData = typeof data.eleventhMarksData === 'object'
      ? JSON.stringify(data.eleventhMarksData)
      : data.eleventhMarksData || null;

    const documentsData = typeof data.documentsData === 'object'
      ? JSON.stringify(data.documentsData)
      : data.documentsData || null;

    const parentName = data.parentName || data.fatherName || data.motherName || 'Parent / Guardian';
    const parentPhone = data.parentPhone || data.fatherPhone || data.motherPhone || '';

    return this.prisma.admissionApplication.create({
      data: {
        schoolId,
        applicationNo,
        studentName: data.studentName,
        dob: new Date(data.dob || Date.now()),
        age: data.age ? parseInt(data.age.toString(), 10) : undefined,
        gender: data.gender || 'Not Specified',
        studentPhotoUrl: data.studentPhotoUrl || null,
        aadharNumber: data.aadharNumber || null,
        bloodGroup: data.bloodGroup || null,
        previousSchool: data.previousSchool || null,
        previousBoard: data.previousBoard || null,
        fatherName: data.fatherName || null,
        fatherPhone: data.fatherPhone || null,
        fatherPhotoUrl: data.fatherPhotoUrl || null,
        motherName: data.motherName || null,
        motherPhone: data.motherPhone || null,
        motherPhotoUrl: data.motherPhotoUrl || null,
        parentName,
        parentPhone,
        parentEmail: data.parentEmail || 'admissions@school.edu',
        emergencyPhone: data.emergencyPhone || null,
        address: data.address || '',
        targetGrade: data.targetGrade,
        streamGroup: data.streamGroup || null,
        tenthMarksData,
        eleventhMarksData,
        documentsData,
        status: ApplicationStatus.SUBMITTED,
      },
    });
  }

  async uploadApplicationDocument(id: string, docData: { title: string; docType: string; fileUrl: string }) {
    const app = await this.prisma.admissionApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');

    let currentDocs: any[] = [];
    try {
      if (app.documentsData) {
        currentDocs = JSON.parse(app.documentsData);
      }
    } catch {
      currentDocs = [];
    }

    const newDoc = {
      id: `doc-${Date.now()}`,
      title: docData.title,
      docType: docData.docType,
      fileUrl: docData.fileUrl,
      uploadedAt: new Date().toISOString(),
      verificationStatus: 'VERIFIED',
    };

    const updatedDocs = [...currentDocs.filter((d) => d.docType !== docData.docType), newDoc];

    return this.prisma.admissionApplication.update({
      where: { id },
      data: {
        documentsData: JSON.stringify(updatedDocs),
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
      // Complete enrollment: Create student, parent link, documents, and active status
      return this.prisma.$transaction(async (tx) => {
        const updatedApp = await tx.admissionApplication.update({
          where: { id },
          data: { status: ApplicationStatus.ENROLLED },
        });

        // Create or Link Parent
        const parent = await tx.parentGuardian.create({
          data: {
            schoolId: app.schoolId,
            fatherName: app.fatherName,
            fatherPhone: app.fatherPhone,
            fatherPhotoUrl: app.fatherPhotoUrl,
            motherName: app.motherName,
            motherPhone: app.motherPhone,
            motherPhotoUrl: app.motherPhotoUrl,
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
            bloodGroup: app.bloodGroup,
            photoUrl: app.studentPhotoUrl,
            studentPhotoUrl: app.studentPhotoUrl,
            aadharNumber: app.aadharNumber,
            fatherPhotoUrl: app.fatherPhotoUrl,
            motherPhotoUrl: app.motherPhotoUrl,
            previousSchool: app.previousSchool,
            streamGroup: app.streamGroup,
            tenthMarksData: app.tenthMarksData,
            eleventhMarksData: app.eleventhMarksData,
            classId: enrollmentData.classId,
            sectionId: enrollmentData.sectionId,
            academicYearId: enrollmentData.academicYearId,
            parentId: parent.id,
            status: 'ACTIVE',
            address: app.address,
          },
        });

        // Migrate uploaded documents into StudentDocument records
        if (app.documentsData) {
          try {
            const docs: any[] = JSON.parse(app.documentsData);
            if (Array.isArray(docs)) {
              for (const doc of docs) {
                await tx.studentDocument.create({
                  data: {
                    schoolId: app.schoolId,
                    studentId: student.id,
                    title: doc.title || doc.docType,
                    docType: doc.docType,
                    fileUrl: doc.fileUrl,
                    verificationStatus: doc.verificationStatus || 'VERIFIED',
                  },
                });
              }
            }
          } catch {
            // Ignore parse errors if documents format is non-array
          }
        }

        return { application: updatedApp, student };
      });
    }

    return this.prisma.admissionApplication.update({
      where: { id },
      data: { status: decision as ApplicationStatus },
    });
  }
}
