import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StaffHrService } from './staff-hr.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { LeaveStatus, Role } from '@prisma/client';

@Controller('hr')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
export class StaffHrController {
  constructor(private hrService: StaffHrService) {}

  @Get('departments')
  async getDepartments(@Tenant() schoolId: string) {
    return this.hrService.getDepartments(schoolId);
  }

  @Post('departments')
  async createDepartment(@Tenant() schoolId: string, @Body('name') name: string) {
    return this.hrService.createDepartment(schoolId, name);
  }

  @Get('staff')
  async getStaff(@Tenant() schoolId: string, @Query('departmentId') departmentId?: string) {
    return this.hrService.getStaff(schoolId, departmentId);
  }

  @Post('staff')
  async addStaff(@Tenant() schoolId: string, @Body() body: any) {
    return this.hrService.addStaff(schoolId, body);
  }

  @Patch('staff/:id')
  async updateStaff(@Tenant() schoolId: string, @Param('id') id: string, @Body() body: any) {
    return this.hrService.updateStaff(schoolId, id, body);
  }

  @Delete('staff/:id')
  async deleteStaff(@Tenant() schoolId: string, @Param('id') id: string) {
    return this.hrService.deleteStaff(schoolId, id);
  }

  @Get('leaves')
  async getLeaves(@Tenant() schoolId: string, @Query('status') status?: LeaveStatus) {
    return this.hrService.getLeaves(schoolId, status);
  }

  @Post('leaves')
  async applyLeave(@Tenant() schoolId: string, @Body() body: any) {
    return this.hrService.applyLeave(schoolId, body);
  }

  @Patch('leaves/:id/status')
  async updateLeaveStatus(
    @Tenant() schoolId: string,
    @Param('id') id: string,
    @Body('status') status: LeaveStatus,
  ) {
    return this.hrService.updateLeaveStatus(schoolId, id, status);
  }

  @Get('payrolls')
  async getPayrolls(
    @Tenant() schoolId: string,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.hrService.getPayrolls(schoolId, month || new Date().getMonth() + 1, year || new Date().getFullYear());
  }

  @Post('payrolls/run')
  async runPayroll(
    @Tenant() schoolId: string,
    @Body('month') month: number,
    @Body('year') year: number,
  ) {
    return this.hrService.runPayroll(schoolId, month || new Date().getMonth() + 1, year || new Date().getFullYear());
  }
}
