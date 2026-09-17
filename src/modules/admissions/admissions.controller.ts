import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdmissionsService } from './admissions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { ApplicationStatus } from '@prisma/client';

@Controller('admissions')
@UseGuards(JwtAuthGuard)
export class AdmissionsController {
  constructor(private admissionsService: AdmissionsService) {}

  @Get('enquiries')
  async getEnquiries(@Tenant() schoolId: string) {
    return this.admissionsService.getEnquiries(schoolId);
  }

  @Post('enquiries')
  async createEnquiry(@Tenant() schoolId: string, @Body() body: any) {
    return this.admissionsService.createEnquiry(schoolId, body);
  }

  @Patch('enquiries/:id/status')
  async updateEnquiryStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
  ) {
    return this.admissionsService.updateEnquiryStatus(id, body.status, body.notes);
  }

  @Get('applications')
  async getApplications(
    @Tenant() schoolId: string,
    @Query('status') status?: ApplicationStatus,
  ) {
    return this.admissionsService.getApplications(schoolId, status);
  }

  @Post('applications')
  async submitApplication(@Tenant() schoolId: string, @Body() body: any) {
    return this.admissionsService.submitApplication(schoolId, body);
  }

  @Post('applications/:id/interview')
  async recordInterview(@Param('id') id: string, @Body() body: any) {
    return this.admissionsService.recordInterview(id, body);
  }

  @Post('applications/:id/decision')
  async decideAdmission(
    @Param('id') id: string,
    @Body() body: { decision: 'APPROVED' | 'WAITLISTED' | 'REJECTED'; enrollmentData?: any },
  ) {
    return this.admissionsService.decideAdmission(id, body.decision, body.enrollmentData);
  }
}
