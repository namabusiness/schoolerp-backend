import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
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

  // Student Leave Applications (Parent & Teacher Two-Way Flow)
  @Post('student-leave')
  async applyStudentLeave(@Tenant() schoolId: string, @Body() body: any) {
    return this.attendanceService.applyStudentLeave(schoolId, body);
  }

  @Get('student-leave')
  async getStudentLeaves(@Tenant() schoolId: string, @Query() query: any) {
    return this.attendanceService.getStudentLeaves(schoolId, query);
  }

  @Patch('student-leave/:id/decision')
  async decideStudentLeave(
    @Tenant() schoolId: string,
    @Param('id') id: string,
    @Body() body: { decision: 'APPROVED' | 'REJECTED'; reviewerName?: string; reviewNote?: string },
  ) {
    return this.attendanceService.decideStudentLeave(
      schoolId,
      id,
      body.decision,
      body.reviewerName || 'Class Teacher',
      body.reviewNote,
    );
  }

  @Get('student/:studentId')
  async getStudentAttendance(
    @Tenant() schoolId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.attendanceService.getStudentAttendance(schoolId, studentId);
  }
}


