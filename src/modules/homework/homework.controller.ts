import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('homework')
@UseGuards(JwtAuthGuard)
export class HomeworkController {
  constructor(private homeworkService: HomeworkService) {}

  @Get()
  async getHomeworks(@Tenant() schoolId: string, @Query() query: any) {
    return this.homeworkService.getHomeworks(schoolId, query);
  }

  @Get(':id')
  async getHomeworkById(@Tenant() schoolId: string, @Param('id') id: string) {
    return this.homeworkService.getHomeworkById(schoolId, id);
  }

  @Post()
  async createHomework(@Tenant() schoolId: string, @Body() body: any) {
    return this.homeworkService.createHomework(schoolId, body);
  }

  @Get(':id/submissions')
  async getSubmissions(@Tenant() schoolId: string, @Param('id') homeworkId: string) {
    return this.homeworkService.getSubmissions(schoolId, homeworkId);
  }

  @Post(':id/submit')
  async submitHomework(
    @Tenant() schoolId: string,
    @Param('id') homeworkId: string,
    @Body() body: any,
  ) {
    return this.homeworkService.submitHomework(schoolId, homeworkId, body);
  }

  @Patch('submissions/:submissionId/grade')
  async gradeSubmission(
    @Tenant() schoolId: string,
    @Param('submissionId') submissionId: string,
    @Body() body: { grade: string; feedback: string; allowResubmit?: boolean },
  ) {
    return this.homeworkService.gradeSubmission(schoolId, submissionId, body);
  }
}

