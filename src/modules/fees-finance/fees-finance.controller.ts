import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { FeesFinanceService } from './fees-finance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { InvoiceStatus } from '@prisma/client';

@Controller('fees')
@UseGuards(JwtAuthGuard)
export class FeesFinanceController {
  constructor(private feesService: FeesFinanceService) {}

  @Get('summary')
  async getSummary(@Tenant() schoolId: string) {
    return this.feesService.getFinanceSummary(schoolId);
  }

  @Get('heads')
  async getHeads(@Tenant() schoolId: string) {
    return this.feesService.getFeeHeads(schoolId);
  }

  @Post('heads')
  async createHead(@Tenant() schoolId: string, @Body() body: any) {
    return this.feesService.createFeeHead(schoolId, body);
  }

  @Get('structures')
  async getStructures(@Tenant() schoolId: string, @Query('classId') classId?: string) {
    return this.feesService.getFeeStructures(schoolId, classId);
  }

  @Post('structures')
  async createStructure(@Tenant() schoolId: string, @Body() body: any) {
    return this.feesService.createFeeStructure(schoolId, body);
  }

  @Get('invoices')
  async getInvoices(
    @Tenant() schoolId: string,
    @Query('status') status?: InvoiceStatus,
    @Query('studentId') studentId?: string,
  ) {
    return this.feesService.getInvoices(schoolId, { status, studentId });
  }

  @Post('invoices')
  async generateInvoice(@Tenant() schoolId: string, @Body() body: any) {
    return this.feesService.generateInvoice(schoolId, body);
  }

  @Post('payments')
  async recordPayment(@Tenant() schoolId: string, @Body() body: any) {
    return this.feesService.recordPayment(schoolId, body);
  }
}
