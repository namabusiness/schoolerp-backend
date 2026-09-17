import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PromotionDecision } from '@prisma/client';

@Injectable()
export class PromotionService {
  constructor(private prisma: PrismaService) {}

  // Get student clearance status for promotion
  async getStudentClearance(schoolId: string, studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId, schoolId },
      include: {
        invoices: { where: { status: { not: 'PAID' } } },
        gradeClass: true,
        section: true,
      },
    });
    if (!student) throw new BadRequestException('Student not found');

    const unreturnedLoans = await this.prisma.bookLoan.count({
      where: { schoolId, borrowerId: studentId, status: { not: 'RETURNED' } },
    });

    const pendingFeeAmount = student.invoices.reduce((acc, inv) => acc + inv.balanceAmount, 0);

    return {
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      currentClass: student.gradeClass.name,
      currentSection: student.section.name,
      feesCleared: pendingFeeAmount === 0,
      pendingFeeAmount,
      libraryCleared: unreturnedLoans === 0,
      unreturnedBooks: unreturnedLoans,
      transportCleared: true,
      readyForPromotion: pendingFeeAmount === 0 && unreturnedLoans === 0,
    };
  }

  // Process Promotion Decision (PROMOTED, REPEAT, TRANSFER_EXIT)
  async processPromotion(schoolId: string, data: {
    studentId: string;
    academicYearId: string;
    decision: PromotionDecision;
    toClassId?: string;
    toSectionId?: string;
    generateTC?: boolean;
  }) {
    const student = await this.prisma.student.findUnique({
      where: { id: data.studentId, schoolId },
      include: { gradeClass: true },
    });
    if (!student) throw new BadRequestException('Student not found');

    return this.prisma.$transaction(async (tx) => {
      let targetClassName = student.gradeClass.name;
      if (data.decision === PromotionDecision.PROMOTED && data.toClassId && data.toSectionId) {
        const nextClass = await tx.gradeClass.findUnique({ where: { id: data.toClassId } });
        if (nextClass) targetClassName = nextClass.name;

        await tx.student.update({
          where: { id: data.studentId },
          data: {
            classId: data.toClassId,
            sectionId: data.toSectionId,
            academicYearId: data.academicYearId,
            status: 'ACTIVE',
          },
        });
      } else if (data.decision === PromotionDecision.TRANSFER_EXIT) {
        await tx.student.update({
          where: { id: data.studentId },
          data: { status: 'TRANSFERRED' },
        });

        if (data.generateTC) {
          const tcNumber = `TC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          await tx.issuedCertificate.create({
            data: {
              schoolId,
              studentId: data.studentId,
              certificateType: 'TRANSFER_CERTIFICATE',
              certificateNo: tcNumber,
              issueDate: new Date(),
              approvedBy: 'Principal',
              status: 'ISSUED',
            },
          });
        }
      }

      return tx.promotionRecord.create({
        data: {
          schoolId,
          studentId: data.studentId,
          academicYearId: data.academicYearId,
          decision: data.decision,
          fromClass: student.gradeClass.name,
          toClass: targetClassName,
          feesCleared: true,
          libraryCleared: true,
          transportCleared: true,
        },
      });
    });
  }

  // Year-end rollover summary
  async getPromotionRecords(schoolId: string, academicYearId?: string) {
    const where: any = { schoolId };
    if (academicYearId) where.academicYearId = academicYearId;
    return this.prisma.promotionRecord.findMany({
      where,
      orderBy: { processedAt: 'desc' },
    });
  }
}
