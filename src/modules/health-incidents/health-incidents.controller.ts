import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { HealthIncidentsService } from './health-incidents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('health')
@UseGuards(JwtAuthGuard)
export class HealthIncidentsController {
  constructor(private healthService: HealthIncidentsService) {}

  @Get('incidents')
  async getIncidents(@Tenant() schoolId: string, @Query('studentId') studentId?: string) {
    return this.healthService.getIncidents(schoolId, studentId);
  }

  @Post('incidents')
  async logIncident(@Tenant() schoolId: string, @Body() body: any) {
    return this.healthService.logIncident(schoolId, body);
  }

  @Get('records/:studentId')
  async getHealthRecord(@Tenant() schoolId: string, @Param('studentId') studentId: string) {
    return this.healthService.getHealthRecord(schoolId, studentId);
  }

  @Put('records/:studentId')
  async updateHealthRecord(
    @Tenant() schoolId: string,
    @Param('studentId') studentId: string,
    @Body() body: any,
  ) {
    return this.healthService.updateHealthRecord(schoolId, studentId, body);
  }
}
