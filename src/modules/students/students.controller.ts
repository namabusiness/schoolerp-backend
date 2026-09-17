import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('students')
@UseGuards(JwtAuthGuard)
export class StudentsController {
  constructor(private studentsService: StudentsService) {}

  @Get()
  async getStudents(@Tenant() schoolId: string, @Query() query: any) {
    return this.studentsService.getStudents(schoolId, query);
  }

  @Get(':id/360')
  async getStudent360(@Tenant() schoolId: string, @Param('id') id: string) {
    return this.studentsService.getStudent360(schoolId, id);
  }

  @Patch(':id')
  async updateStudent(
    @Tenant() schoolId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.studentsService.updateStudent(schoolId, id, body);
  }
}
