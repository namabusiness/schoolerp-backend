import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationStatus } from '@prisma/client';

@Injectable()
export class AdmissionsService {
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

    const fallback = await this.prisma.school.findFirst();
    return fallback?.id || 'school-greenwood-high';
  }

  // Enquiries
  async getEnquiries(schoolId: string) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);
    return this.prisma.enquiry.findMany({
      where: { schoolId: resolvedSchoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createEnquiry(schoolId: string, data: any) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);
    return this.prisma.enquiry.create({
      data: {
        schoolId: resolvedSchoolId,
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
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);
    const where: any = { schoolId: resolvedSchoolId };
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
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);
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
    const parentPhone = data.parentPhone || data.fatherPhone || data.motherPhone || '9876543210';

    // 1. Create the Admission Application in DB
    const app = await this.prisma.admissionApplication.create({
      data: {
        schoolId: resolvedSchoolId,
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
        targetGrade: data.targetGrade || 'Grade 10',
        streamGroup: data.streamGroup || null,
        tenthMarksData,
        eleventhMarksData,
        documentsData,
        status: ApplicationStatus.SUBMITTED,
      },
    });

    // 2. Resolve or automatically create GradeClass for this school
    const className = data.targetGrade || 'Grade 10';
    let gradeClass = await this.prisma.gradeClass.findFirst({
      where: { schoolId: resolvedSchoolId, name: className },
    });
    if (!gradeClass) {
      gradeClass = await this.prisma.gradeClass.create({
        data: {
          schoolId: resolvedSchoolId,
          name: className,
          code: className.replace(/\s+/g, '').toUpperCase().slice(0, 6),
        },
      });
    }

    // 3. Resolve or automatically create Section
    let section = await this.prisma.section.findFirst({
      where: { schoolId: resolvedSchoolId, classId: gradeClass.id },
    });
    if (!section) {
      section = await this.prisma.section.create({
        data: {
          schoolId: resolvedSchoolId,
          classId: gradeClass.id,
          name: 'Section A',
          capacity: 40,
        },
      });
    }

    // 4. Resolve AcademicYear
    let academicYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: resolvedSchoolId, isCurrent: true },
    });
    if (!academicYear) {
      academicYear = await this.prisma.academicYear.findFirst({
        where: { schoolId: resolvedSchoolId },
      });
    }
    if (!academicYear) {
      academicYear = await this.prisma.academicYear.create({
        data: {
          schoolId: resolvedSchoolId,
          name: `${new Date().getFullYear()}-${new Date().getFullYear() + 1} Academic Session`,
          startDate: new Date(`${new Date().getFullYear()}-06-01`),
          endDate: new Date(`${new Date().getFullYear() + 1}-05-31`),
          isCurrent: true,
        },
      });
    }

    // 5. Create ParentGuardian
    const parent = await this.prisma.parentGuardian.create({
      data: {
        schoolId: resolvedSchoolId,
        fatherName: data.fatherName || null,
        fatherPhone: data.fatherPhone || null,
        fatherPhotoUrl: data.fatherPhotoUrl || null,
        motherName: data.motherName || null,
        motherPhone: data.motherPhone || null,
        motherPhotoUrl: data.motherPhotoUrl || null,
        guardianName: parentName,
        phone: parentPhone,
        email: data.parentEmail || null,
        address: data.address || '',
      },
    });

    // 6. Generate Admission Number and Roll Number
    const admissionNumber = `ADM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const rollNumber = `${gradeClass.code || 'G'}-A-${Math.floor(10 + Math.random() * 89)}`;

    // 7. Create Student record in DB
    const student = await this.prisma.student.create({
      data: {
        schoolId: resolvedSchoolId,
        admissionNumber,
        rollNumber,
        firstName: data.studentName.split(' ')[0] || data.studentName,
        lastName: data.studentName.split(' ').slice(1).join(' ') || '',
        dob: new Date(data.dob || Date.now()),
        gender: data.gender || 'Not Specified',
        bloodGroup: data.bloodGroup || null,
        photoUrl: data.studentPhotoUrl || null,
        studentPhotoUrl: data.studentPhotoUrl || null,
        aadharNumber: data.aadharNumber || null,
        fatherPhotoUrl: data.fatherPhotoUrl || null,
        motherPhotoUrl: data.motherPhotoUrl || null,
        previousSchool: data.previousSchool || null,
        streamGroup: data.streamGroup || null,
        tenthMarksData,
        eleventhMarksData,
        classId: gradeClass.id,
        sectionId: section.id,
        academicYearId: academicYear.id,
        parentId: parent.id,
        status: 'ACTIVE',
        address: data.address || '',
      },
    });

    return {
      ...app,
      student,
    };
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

    let updatedDocs: any[] = [];
    if (docData.docType === 'BUNDLE') {
      try {
        const bundle = JSON.parse(docData.fileUrl);
        if (Array.isArray(bundle)) {
          updatedDocs = bundle;
        }
      } catch {
        updatedDocs = currentDocs;
      }
    } else {
      const newDoc = {
        id: `doc-${Date.now()}`,
        title: docData.title,
        docType: docData.docType,
        fileUrl: docData.fileUrl,
        uploadedAt: new Date().toISOString(),
        verificationStatus: 'VERIFIED',
      };
      updatedDocs = [...currentDocs.filter((d) => d.docType !== docData.docType), newDoc];
    }

    const updatedApp = await this.prisma.admissionApplication.update({
      where: { id },
      data: {
        documentsData: JSON.stringify(updatedDocs),
      },
    });

    // Also sync documents to Student record if present
    try {
      const student = await this.prisma.student.findFirst({
        where: {
          schoolId: app.schoolId,
          OR: [
            { aadharNumber: app.aadharNumber || '____none____' },
            { firstName: app.studentName.split(' ')[0] },
          ],
        },
      });

      if (student && Array.isArray(updatedDocs)) {
        for (const doc of updatedDocs) {
          if (doc.fileUrl) {
            const existing = await this.prisma.studentDocument.findFirst({
              where: { studentId: student.id, docType: doc.docType },
            });
            if (existing) {
              await this.prisma.studentDocument.update({
                where: { id: existing.id },
                data: { fileUrl: doc.fileUrl, title: doc.title || doc.docType },
              });
            } else {
              await this.prisma.studentDocument.create({
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
        }
      }
    } catch {
      // ignore sync errors
    }

    return updatedApp;
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

    if (decision === 'APPROVED') {
      return this.prisma.$transaction(async (tx) => {
        const updatedApp = await tx.admissionApplication.update({
          where: { id },
          data: { status: ApplicationStatus.ENROLLED },
        });

        // Check if student already created
        const existingStudent = await tx.student.findFirst({
          where: {
            schoolId: app.schoolId,
            OR: [
              { aadharNumber: app.aadharNumber || '____none____' },
              { firstName: app.studentName.split(' ')[0] },
            ],
          },
        });

        if (existingStudent) {
          await tx.student.update({
            where: { id: existingStudent.id },
            data: { status: 'ACTIVE' },
          });
          return { application: updatedApp, student: existingStudent };
        }

        // Create ParentGuardian
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
            phone: app.parentPhone || '9876543210',
            email: app.parentEmail,
            address: app.address,
          },
        });

        const admissionNumber = `ADM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        let classId = enrollmentData?.classId;
        let sectionId = enrollmentData?.sectionId;
        let academicYearId = enrollmentData?.academicYearId;

        if (!classId || !sectionId || !academicYearId) {
          const cls = await tx.gradeClass.findFirst({ where: { schoolId: app.schoolId } });
          classId = cls?.id || 'class-g10';
          const sec = await tx.section.findFirst({ where: { schoolId: app.schoolId, classId } });
          sectionId = sec?.id || 'sec-g10-a';
          const ay = await tx.academicYear.findFirst({ where: { schoolId: app.schoolId } });
          academicYearId = ay?.id || 'ay-2026-2027';
        }

        const student = await tx.student.create({
          data: {
            schoolId: app.schoolId,
            admissionNumber,
            rollNumber: enrollmentData?.rollNumber || '01',
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
            classId,
            sectionId,
            academicYearId,
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

