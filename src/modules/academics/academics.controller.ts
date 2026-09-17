import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AcademicsService } from './academics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('academics')
@UseGuards(JwtAuthGuard)
export class AcademicsController {
  constructor(private academicsService: AcademicsService) {}

  @Get('years')
  async getYears(@Tenant() schoolId: string) {
    return this.academicsService.getAcademicYears(schoolId);
  }

  @Post('years')
  async createYear(@Tenant() schoolId: string, @Body() body: any) {
    return this.academicsService.createAcademicYear(schoolId, body);
  }

  @Get('classes')
  async getClasses(@Tenant() schoolId: string) {
    return this.academicsService.getClasses(schoolId);
  }

  @Post('classes')
  async createClass(@Tenant() schoolId: string, @Body() body: any) {
    return this.academicsService.createClass(schoolId, body);
  }

  @Post('classes/:id/sections')
  async createSection(
    @Tenant() schoolId: string,
    @Body() body: { classId: string; name: string; capacity?: number },
  ) {
    return this.academicsService.createSection(schoolId, body.classId, body);
  }

  @Get('subjects')
  async getSubjects(@Tenant() schoolId: string, @Query('classId') classId?: string) {
    return this.academicsService.getSubjects(schoolId, classId);
  }

  @Post('subjects')
  async createSubject(@Tenant() schoolId: string, @Body() body: any) {
    return this.academicsService.createSubject(schoolId, body);
  }

  @Get('timetable')
  async getTimetable(@Tenant() schoolId: string, @Query() query: any) {
    return this.academicsService.getTimetable(schoolId, query);
  }

  @Post('timetable')
  async createTimetableSlot(@Tenant() schoolId: string, @Body() body: any) {
    return this.academicsService.createTimetableSlot(schoolId, body);
  }
}
