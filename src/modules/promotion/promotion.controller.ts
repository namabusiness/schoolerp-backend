import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('promotion')
@UseGuards(JwtAuthGuard)
export class PromotionController {
  constructor(private promotionService: PromotionService) {}

  @Get('clearance/:studentId')
  async getClearance(@Tenant() schoolId: string, @Param('studentId') studentId: string) {
    return this.promotionService.getStudentClearance(schoolId, studentId);
  }

  @Post('process')
  async processPromotion(@Tenant() schoolId: string, @Body() body: any) {
    return this.promotionService.processPromotion(schoolId, body);
  }

  @Get('records')
  async getRecords(@Tenant() schoolId: string, @Query('academicYearId') academicYearId?: string) {
    return this.promotionService.getPromotionRecords(schoolId, academicYearId);
  }
}
