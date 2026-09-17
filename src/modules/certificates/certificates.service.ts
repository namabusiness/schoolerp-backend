import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CertificateType } from '@prisma/client';

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  async getCertificates(schoolId: string, studentId?: string) {
    const where: any = { schoolId };
    if (studentId) where.studentId = studentId;
    return this.prisma.issuedCertificate.findMany({
      where,
      include: {
        student: { include: { gradeClass: true, section: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  async issueCertificate(schoolId: string, data: {
    studentId: string;
    certificateType: CertificateType;
    approvedBy?: string;
  }) {
    const student = await this.prisma.student.findUnique({ where: { id: data.studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const prefix = data.certificateType.slice(0, 3).toUpperCase();
    const certificateNo = `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return this.prisma.issuedCertificate.create({
      data: {
        schoolId,
        studentId: data.studentId,
        certificateType: data.certificateType,
        certificateNo,
        issueDate: new Date(),
        approvedBy: data.approvedBy || 'School Principal',
        status: 'ISSUED',
      },
      include: {
        student: { include: { gradeClass: true, section: true } },
      },
    });
  }
}
