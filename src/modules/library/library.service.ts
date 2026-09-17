import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoanStatus } from '@prisma/client';

@Injectable()
export class LibraryService {
  constructor(private prisma: PrismaService) {}

  async getCatalogue(schoolId: string, search?: string) {
    const where: any = { schoolId };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { isbn: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.bookCatalogue.findMany({
      where,
      include: {
        _count: { select: { loans: true } },
      },
      orderBy: { title: 'asc' },
    });
  }

  async addBook(schoolId: string, data: any) {
    return this.prisma.bookCatalogue.create({
      data: {
        schoolId,
        title: data.title,
        author: data.author,
        isbn: data.isbn,
        category: data.category || 'General',
        copiesCount: Number(data.copiesCount) || 1,
        availableCount: Number(data.copiesCount) || 1,
      },
    });
  }

  async getLoans(schoolId: string, status?: LoanStatus) {
    const where: any = { schoolId };
    if (status) where.status = status;
    return this.prisma.bookLoan.findMany({
      where,
      include: { book: true },
      orderBy: { issueDate: 'desc' },
    });
  }

  async issueBook(schoolId: string, data: {
    bookId: string;
    borrowerId: string;
    borrowerName: string;
    dueDays?: number;
  }) {
    const book = await this.prisma.bookCatalogue.findUnique({ where: { id: data.bookId } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.availableCount <= 0) throw new BadRequestException('No copies available');

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (data.dueDays || 14));

    return this.prisma.$transaction(async (tx) => {
      await tx.bookCatalogue.update({
        where: { id: data.bookId },
        data: { availableCount: { decrement: 1 } },
      });

      return tx.bookLoan.create({
        data: {
          schoolId,
          bookId: data.bookId,
          borrowerId: data.borrowerId,
          borrowerName: data.borrowerName,
          dueDate,
          status: LoanStatus.ISSUED,
        },
        include: { book: true },
      });
    });
  }

  async returnBook(schoolId: string, loanId: string) {
    const loan = await this.prisma.bookLoan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found');

    const now = new Date();
    let fineAmount = 0;
    if (now > loan.dueDate) {
      const diffDays = Math.ceil((now.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      fineAmount = diffDays * 2; // $2/day fine
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.bookCatalogue.update({
        where: { id: loan.bookId },
        data: { availableCount: { increment: 1 } },
      });

      return tx.bookLoan.update({
        where: { id: loanId },
        data: {
          returnDate: now,
          fineAmount,
          status: LoanStatus.RETURNED,
        },
      });
    });
  }
}
