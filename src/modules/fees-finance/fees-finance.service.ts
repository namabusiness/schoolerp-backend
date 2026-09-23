import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FastCacheService } from '../../common/cache/fast-cache.service';
import { InvoiceStatus } from '@prisma/client';

@Injectable()
export class FeesFinanceService {
  constructor(
    private prisma: PrismaService,
    private fastCache: FastCacheService,
  ) {}

  public clearFeesCache(schoolId?: string) {
    this.fastCache.delByPrefix('fees:');
  }

  // Fee Heads & Structure
  async getFeeHeads(schoolId: string) {
    return this.fastCache.getOrSet(`fees:heads:${schoolId}`, async () => {
      return this.prisma.feeHead.findMany({ where: { schoolId } });
    }, 60);
  }

  async createFeeHead(schoolId: string, data: { name: string; description?: string }) {
    const res = await this.prisma.feeHead.create({
      data: { schoolId, name: data.name, description: data.description },
    });
    this.clearFeesCache(schoolId);
    return res;
  }

  async getFeeStructures(schoolId: string, classId?: string) {
    const cacheKey = `fees:structures:${schoolId}:${classId || 'ALL'}`;
    return this.fastCache.getOrSet(cacheKey, async () => {
      const where: any = { schoolId };
      if (classId) where.classId = classId;
      return this.prisma.feeStructure.findMany({ where });
    }, 60);
  }

  async createFeeStructure(schoolId: string, data: any) {
    const res = await this.prisma.feeStructure.create({
      data: {
        schoolId,
        classId: data.classId,
        headName: data.headName,
        amount: Number(data.amount),
        frequency: data.frequency || 'TERMWISE',
      },
    });
    this.clearFeesCache(schoolId);
    return res;
  }

  // Invoices & Demands
  async getInvoices(schoolId: string, params: { status?: InvoiceStatus; studentId?: string }) {
    const cacheKey = `fees:invoices:${schoolId}:${params.status || 'ALL'}:${params.studentId || 'ALL'}`;
    return this.fastCache.getOrSet(cacheKey, async () => {
      const where: any = { schoolId };
      if (params.status) where.status = params.status;
      if (params.studentId) where.studentId = params.studentId;

      return this.prisma.studentFeeInvoice.findMany({
        where,
        include: {
          student: { include: { gradeClass: true, section: true } },
          payments: true,
        },
        orderBy: { dueDate: 'desc' },
      });
    }, 60);
  }

  async generateInvoice(schoolId: string, data: any) {
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
    const res = await this.prisma.studentFeeInvoice.create({
      data: {
        schoolId,
        invoiceNo,
        studentId: data.studentId,
        title: data.title,
        totalAmount: Number(data.totalAmount),
        paidAmount: 0,
        balanceAmount: Number(data.totalAmount),
        dueDate: new Date(data.dueDate),
        status: InvoiceStatus.PENDING,
      },
    });
    this.clearFeesCache(schoolId);
    return res;
  }

  // Payment collection & Receipt issuance
  async recordPayment(schoolId: string, data: {
    invoiceId: string;
    amountPaid: number;
    paymentMode: string;
    transactionRef?: string;
    collectedBy?: string;
  }) {
    const invoice = await this.prisma.studentFeeInvoice.findUnique({
      where: { id: data.invoiceId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const receiptNo = `RCP-${Date.now().toString().slice(-6)}`;
    const newPaidAmount = invoice.paidAmount + Number(data.amountPaid);
    const newBalance = Math.max(0, invoice.totalAmount - newPaidAmount);

    let newStatus: InvoiceStatus = InvoiceStatus.PARTIAL;
    if (newBalance === 0) newStatus = InvoiceStatus.PAID;

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.feePayment.create({
        data: {
          schoolId,
          invoiceId: data.invoiceId,
          receiptNo,
          amountPaid: Number(data.amountPaid),
          paymentMode: data.paymentMode,
          transactionRef: data.transactionRef,
          collectedBy: data.collectedBy,
        },
      });

      const updatedInvoice = await tx.studentFeeInvoice.update({
        where: { id: data.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalance,
          status: newStatus,
        },
      });

      return { payment, invoice: updatedInvoice };
    });

    this.clearFeesCache(schoolId);
    return result;
  }

  // Financial Reports
  async getFinanceSummary(schoolId: string) {
    return this.fastCache.getOrSet(`fees:summary:${schoolId}`, async () => {
      const invoices = await this.prisma.studentFeeInvoice.findMany({
        where: { schoolId },
      });

      const totalDemanded = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
      const totalCollected = invoices.reduce((acc, inv) => acc + inv.paidAmount, 0);
      const totalOutstanding = invoices.reduce((acc, inv) => acc + inv.balanceAmount, 0);

      return {
        totalDemanded,
        totalCollected,
        totalOutstanding,
        collectionRate: totalDemanded > 0 ? Math.round((totalCollected / totalDemanded) * 100) : 0,
        invoicesCount: invoices.length,
      };
    }, 60);
  }
}
