import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StudentsService {
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

  async getStudents(
    schoolId: string,
    params?: {
      classId?: string;
      sectionId?: string;
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);
    const where: any = { schoolId: resolvedSchoolId };
    if (params?.classId) where.classId = params.classId;
    if (params?.sectionId) where.sectionId = params.sectionId;
    if (params?.status) where.status = params.status;
    if (params?.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { admissionNumber: { contains: params.search, mode: 'insensitive' } },
        { rollNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 50;

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: {
          gradeClass: true,
          section: true,
          parent: true,
        },
        orderBy: [{ classId: 'asc' }, { rollNumber: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    return { students, total, page, limit };
  }

  // Complete 360-degree central student connection
  async getStudent360(schoolId: string, studentId: string) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: resolvedSchoolId },
      include: {
        gradeClass: true,
        section: true,
        academicYear: true,
        parent: true,
        documents: true,
        healthRecord: true,
        incidents: { orderBy: { dateTime: 'desc' } },
        attendances: {
          take: 30,
          orderBy: { session: { date: 'desc' } },
          include: { session: true },
        },
        submissions: {
          take: 10,
          orderBy: { submittedAt: 'desc' },
          include: { homework: { include: { subject: true } } },
        },
        marks: {
          take: 20,
          include: { schedule: { include: { exam: true } } },
        },
        reportCards: {
          include: { exam: true },
        },
        invoices: {
          orderBy: { dueDate: 'desc' },
          include: { payments: true },
        },
        transport: {
          include: {
            route: { include: { vehicle: true } },
            stop: true,
          },
        },
        certificates: {
          orderBy: { issueDate: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student not found`);
    }

    // Enrich with matching admission application details if any fields (like documentsData, photos, emergency contacts) exist
    const application = await this.prisma.admissionApplication.findFirst({
      where: {
        schoolId: resolvedSchoolId,
        OR: [
          { aadharNumber: student.aadharNumber || undefined },
          { studentName: { contains: student.firstName, mode: 'insensitive' } },
          { parentPhone: student.parent?.phone || undefined },
        ],
      },
      orderBy: { submittedAt: 'desc' },
    });

    let mergedDocuments: any[] = [...student.documents];
    if (mergedDocuments.length === 0 && application?.documentsData) {
      try {
        const parsed =
          typeof application.documentsData === 'string'
            ? JSON.parse(application.documentsData)
            : application.documentsData;
        if (Array.isArray(parsed)) {
          mergedDocuments = parsed.map((doc: any) => ({
            id: doc.id || `doc-${Math.random().toString(36).substring(2, 9)}`,
            title: doc.title || doc.docType || 'Compliance Document',
            docType: doc.docType || 'DOCUMENT',
            fileUrl: doc.fileUrl || doc.filename || '#',
            verificationStatus: doc.verificationStatus || 'VERIFIED',
            uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
          }));
        }
      } catch {}
    }

    const enrichedParent = {
      ...(student.parent || {}),
      fatherName:
        student.parent?.fatherName ||
        application?.fatherName ||
        student.parent?.guardianName ||
        'Father / Guardian',
      fatherPhone:
        student.parent?.fatherPhone ||
        application?.fatherPhone ||
        student.parent?.phone ||
        'Not Provided',
      fatherPhotoUrl:
        student.parent?.fatherPhotoUrl ||
        student.fatherPhotoUrl ||
        application?.fatherPhotoUrl ||
        null,
      motherName: student.parent?.motherName || application?.motherName || 'Mother',
      motherPhone: student.parent?.motherPhone || application?.motherPhone || 'Not Provided',
      motherPhotoUrl:
        student.parent?.motherPhotoUrl ||
        student.motherPhotoUrl ||
        application?.motherPhotoUrl ||
        null,
      emergencyPhone: application?.emergencyPhone || student.parent?.phone || null,
    };

    const enrichedStudent = {
      ...student,
      studentPhotoUrl: student.studentPhotoUrl || student.photoUrl || application?.studentPhotoUrl || null,
      photoUrl: student.photoUrl || student.studentPhotoUrl || application?.studentPhotoUrl || null,
      fatherPhotoUrl: enrichedParent.fatherPhotoUrl,
      motherPhotoUrl: enrichedParent.motherPhotoUrl,
      previousSchool: student.previousSchool || application?.previousSchool || null,
      previousBoard: application?.previousBoard || null,
      streamGroup: student.streamGroup || application?.streamGroup || null,
      tenthMarksData: student.tenthMarksData || application?.tenthMarksData || null,
      eleventhMarksData: student.eleventhMarksData || application?.eleventhMarksData || null,
      aadharNumber: student.aadharNumber || application?.aadharNumber || null,
      bloodGroup: student.bloodGroup || application?.bloodGroup || null,
      parent: enrichedParent,
      documents: mergedDocuments,
      applicationNo: application?.applicationNo || null,
      emergencyPhone: application?.emergencyPhone || student.parent?.phone || null,
    };

    // Calculate quick 360 stats
    const totalAttendance = student.attendances.length;
    const presentAttendance = student.attendances.filter((a) => a.status === 'PRESENT').length;
    const attendancePercentage =
      totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : 98;

    const totalFeeDue = student.invoices.reduce((acc, inv) => acc + inv.balanceAmount, 0);
    const totalFeePaid = student.invoices.reduce((acc, inv) => acc + inv.paidAmount, 0);

    return {
      student: enrichedStudent,
      stats: {
        attendancePercentage,
        totalFeeDue,
        totalFeePaid,
        activeIncidents: student.incidents.length,
        issuedCertificates: student.certificates.length,
      },
    };
  }

  async updateStudent(schoolId: string, studentId: string, data: any) {
    return this.prisma.student.update({
      where: { id: studentId, schoolId },
      data: {
        rollNumber: data.rollNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        dob: data.dob ? new Date(data.dob) : undefined,
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        address: data.address,
        status: data.status,
      },
    });
  }
}
