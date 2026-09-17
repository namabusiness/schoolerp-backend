import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { DailyOpsService } from './daily-ops.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('daily-ops')
@UseGuards(JwtAuthGuard)
export class DailyOpsController {
  constructor(private dailyOpsService: DailyOpsService) {}

  @Get('overview')
  async getOverview(@Tenant() schoolId: string, @Query('date') date?: string) {
    return this.dailyOpsService.getDailyOverview(schoolId, date);
  }

  @Post('substitutions')
  async createSubstitution(@Tenant() schoolId: string, @Body() body: any) {
    return this.dailyOpsService.createSubstitution(schoolId, body);
  }
}
