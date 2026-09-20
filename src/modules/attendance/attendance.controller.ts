import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Get('session')
  async getSession(
    @Tenant() schoolId: string,
    @Query('sectionId') sectionId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getSession(schoolId, sectionId, date || new Date().toISOString());
  }

  @Post('submit')
  async submitAttendance(
    @Tenant() schoolId: string,
    @Body() body: { sessionId: string; records: any[]; lockSession?: boolean },
  ) {
    return this.attendanceService.submitAttendance(
      schoolId,
      body.sessionId,
      body.records,
      body.lockSession,
    );
  }

  @Get('stats')
  async getStats(@Tenant() schoolId: string, @Query('sectionId') sectionId?: string) {
    return this.attendanceService.getMonthlyStats(schoolId, sectionId);
  }

  @Get('monthly-matrix')
  async getMonthlyMatrix(
    @Tenant() schoolId: string,
    @Query('sectionId') sectionId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;
    return this.attendanceService.getMonthlyMatrix(schoolId, sectionId, y, m);
  }
}

