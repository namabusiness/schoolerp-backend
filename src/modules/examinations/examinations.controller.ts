import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ExaminationsService } from './examinations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('examinations')
@UseGuards(JwtAuthGuard)
export class ExaminationsController {
  constructor(private examinationsService: ExaminationsService) {}

  @Get()
  async getExams(@Tenant() schoolId: string) {
    return this.examinationsService.getExams(schoolId);
  }

  @Post()
  async createExam(@Tenant() schoolId: string, @Body() body: any) {
    return this.examinationsService.createExam(schoolId, body);
  }

  @Post(':id/schedules')
  async addExamSchedule(
    @Tenant() schoolId: string,
    @Param('id') examId: string,
    @Body() body: any,
  ) {
    return this.examinationsService.addExamSchedule(schoolId, examId, body);
  }

  @Post('schedules/:scheduleId/marks')
  async submitMarks(
    @Tenant() schoolId: string,
    @Param('scheduleId') scheduleId: string,
    @Body('marks') marks: any[],
  ) {
    return this.examinationsService.submitMarks(schoolId, scheduleId, marks);
  }

  @Post(':id/generate-report-cards')
  async generateReportCards(
    @Tenant() schoolId: string,
    @Param('id') examId: string,
    @Body('classId') classId: string,
  ) {
    return this.examinationsService.generateReportCards(schoolId, examId, classId);
  }

  @Get('report-card/:studentId')
  async getReportCard(
    @Tenant() schoolId: string,
    @Param('studentId') studentId: string,
    @Query('examId') examId: string,
  ) {
    return this.examinationsService.getReportCard(schoolId, studentId, examId);
  }

  // -------------------------------------------------------------
  // QUESTION PAPERS
  // -------------------------------------------------------------
  @Get('question-papers')
  async getQuestionPapers(
    @Tenant() schoolId: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('category') category?: string,
  ) {
    return this.examinationsService.getQuestionPapers(schoolId, { classId, subjectId, teacherId, category });
  }

  @Post('question-papers')
  async createQuestionPaper(@Tenant() schoolId: string, @Body() body: any) {
    return this.examinationsService.createQuestionPaper(schoolId, body);
  }

  @Delete('question-papers/:id')
  async deleteQuestionPaper(@Tenant() schoolId: string, @Param('id') id: string) {
    return this.examinationsService.deleteQuestionPaper(schoolId, id);
  }

  // -------------------------------------------------------------
  // CLASS TEACHER MARKS ENROLLMENT
  // -------------------------------------------------------------
  @Post('enroll-marks')
  async enrollClassMarks(@Tenant() schoolId: string, @Body() body: any) {
    return this.examinationsService.enrollClassMarks(schoolId, body);
  }
}

