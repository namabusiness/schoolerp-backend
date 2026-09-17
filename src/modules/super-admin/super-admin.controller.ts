import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, SchoolStatus } from '@prisma/client';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private superAdminService: SuperAdminService) {}

  @Get('stats')
  async getStats() {
    return this.superAdminService.getPlatformStats();
  }

  @Get('schools')
  async getSchools(
    @Query('status') status?: SchoolStatus,
    @Query('search') search?: string,
  ) {
    return this.superAdminService.getSchools(status, search);
  }

  @Get('schools/:id')
  async getSchoolById(@Param('id') id: string) {
    return this.superAdminService.getSchoolById(id);
  }

  @Post('schools')
  async createSchool(@Body() body: any) {
    return this.superAdminService.createSchool(body);
  }

  @Patch('schools/:id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: SchoolStatus) {
    return this.superAdminService.updateSchoolStatus(id, status);
  }

  @Patch('schools/:id/modules')
  async toggleModule(
    @Param('id') schoolId: string,
    @Body() body: { moduleKey: string; isEnabled: boolean },
  ) {
    return this.superAdminService.toggleSchoolModule(schoolId, body.moduleKey, body.isEnabled);
  }

  @Get('administrators')
  async getAdmins(@Query('schoolId') schoolId?: string) {
    return this.superAdminService.getSchoolAdmins(schoolId);
  }

  @Post('administrators')
  async addAdmin(@Body() body: any) {
    return this.superAdminService.addSchoolAdmin(body);
  }

  @Post('support-session')
  async createSupportSession(
    @CurrentUser('id') superAdminId: string,
    @Body() body: { schoolId: string; reason: string },
  ) {
    return this.superAdminService.createSupportSession(
      superAdminId || 'super-admin-root',
      body.schoolId,
      body.reason || 'Technical Assistance',
    );
  }

  @Post('support-session/:id/end')
  async endSupportSession(@Param('id') id: string) {
    return this.superAdminService.endSupportSession(id);
  }

  @Get('plans')
  async getPlans() {
    return this.superAdminService.getPlans();
  }

  @Post('plans')
  async createPlan(@Body() body: any) {
    return this.superAdminService.createPlan(body);
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('schoolId') schoolId?: string,
    @Query('module') module?: string,
    @Query('limit') limit?: number,
  ) {
    return this.superAdminService.getAuditLogs({ schoolId, module, limit: Number(limit) || 100 });
  }
}
