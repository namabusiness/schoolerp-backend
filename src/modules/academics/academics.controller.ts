import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AcademicsService } from './academics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('academics')
@UseGuards(JwtAuthGuard)
export class AcademicsController {
  constructor(private academicsService: AcademicsService) {}

  // -------------------------------------------------------------
  // ACADEMIC YEARS
  // -------------------------------------------------------------
  @Get('years')
  async getYears(@Tenant() schoolId: string) {
    return this.academicsService.getAcademicYears(schoolId);
  }

  @Post('years')
  async createYear(@Tenant() schoolId: string, @Body() body: any) {
    return this.academicsService.createAcademicYear(schoolId, body);
  }

  // -------------------------------------------------------------
  // CLASSES & SECTIONS
  // -------------------------------------------------------------
  @Get('classes')
  async getClasses(@Tenant() schoolId: string) {
    return this.academicsService.getClasses(schoolId);
  }

  @Post('classes')
  async createClass(
    @Tenant() schoolId: string,
    @Body() body: { name: string; code: string; classTeacherId?: string; initialSections?: string[] },
  ) {
    return this.academicsService.createClass(schoolId, body);
  }

  @Delete('classes/:id')
  async deleteClass(@Tenant() schoolId: string, @Param('id') id: string) {
    return this.academicsService.deleteClass(schoolId, id);
  }

  @Post('classes/:id/sections')
  async createSection(
    @Tenant() schoolId: string,
    @Param('id') classId: string,
    @Body() body: { name: string; capacity?: number; classTeacherId?: string },
  ) {
    return this.academicsService.createSection(schoolId, classId, body);
  }

  @Delete('classes/:classId/sections/:sectionId')
  async deleteSection(
    @Tenant() schoolId: string,
    @Param('classId') classId: string,
    @Param('sectionId') sectionId: string,
  ) {
    return this.academicsService.deleteSection(schoolId, sectionId);
  }

  // -------------------------------------------------------------
  // TEACHER ASSIGNMENT
  // -------------------------------------------------------------
  @Patch('classes/:classId/teacher')
  async assignClassTeacher(
    @Tenant() schoolId: string,
    @Param('classId') classId: string,
    @Body() body: { teacherId: string | null },
  ) {
    return this.academicsService.assignClassTeacher(schoolId, classId, body.teacherId);
  }

  @Patch('sections/:sectionId/teacher')
  async assignSectionTeacher(
    @Tenant() schoolId: string,
    @Param('sectionId') sectionId: string,
    @Body() body: { teacherId: string | null },
  ) {
    return this.academicsService.assignSectionTeacher(schoolId, sectionId, body.teacherId);
  }

  // -------------------------------------------------------------
  // CLASS STUDENTS ROSTER & ASSIGNMENT
  // -------------------------------------------------------------
  @Get('classes/:classId/students')
  async getClassStudents(
    @Tenant() schoolId: string,
    @Param('classId') classId: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.academicsService.getClassStudents(schoolId, classId, sectionId);
  }

  @Get('unassigned-students')
  async getUnassignedStudents(@Tenant() schoolId: string) {
    return this.academicsService.getUnassignedStudents(schoolId);
  }

  @Post('unassign-student/:studentId')
  async unassignStudent(@Tenant() schoolId: string, @Param('studentId') studentId: string) {
    return this.academicsService.unassignStudentFromClass(schoolId, studentId);
  }

  @Post('assign-student')
  async assignStudent(
    @Tenant() schoolId: string,
    @Body() body: { studentId: string; classId: string; sectionId: string; rollNumber?: string },
  ) {
    return this.academicsService.assignStudentToClass(schoolId, body);
  }

  // -------------------------------------------------------------
  // SUBJECTS & SUBJECT-WISE TEACHERS
  // -------------------------------------------------------------
  @Get('subjects')
  async getSubjects(@Tenant() schoolId: string, @Query('classId') classId?: string) {
    return this.academicsService.getSubjects(schoolId, classId);
  }

  @Post('subjects')
  async createSubject(
    @Tenant() schoolId: string,
    @Body() body: { classId: string; name: string; code: string; teacherId?: string; periodsPerWeek?: number },
  ) {
    return this.academicsService.createSubject(schoolId, body);
  }

  @Patch('subjects/:id/teacher')
  async assignSubjectTeacher(
    @Tenant() schoolId: string,
    @Param('id') id: string,
    @Body() body: { teacherId: string | null },
  ) {
    return this.academicsService.assignSubjectTeacher(schoolId, id, body.teacherId);
  }

  @Delete('subjects/:id')
  async deleteSubject(@Tenant() schoolId: string, @Param('id') id: string) {
    return this.academicsService.deleteSubject(schoolId, id);
  }

  // -------------------------------------------------------------
  // TIMETABLE
  // -------------------------------------------------------------
  @Get('timetable')
  async getTimetable(@Tenant() schoolId: string, @Query() query: any) {
    return this.academicsService.getTimetable(schoolId, query);
  }

  @Post('timetable')
  async createTimetableSlot(@Tenant() schoolId: string, @Body() body: any) {
    return this.academicsService.createTimetableSlot(schoolId, body);
  }

  @Post('timetable/generate')
  async generateTimetable(@Tenant() schoolId: string, @Body() body: any) {
    return this.academicsService.generateTimetable(schoolId, body);
  }

  @Post('timetable/approve')
  async approveTimetable(
    @Tenant() schoolId: string,
    @Body() body: { classId: string; sectionId?: string },
  ) {
    return this.academicsService.approveTimetable(schoolId, body.classId, body.sectionId);
  }

  @Get('timetable/faculty/:teacherId')
  async getFacultyTimetable(
    @Tenant() schoolId: string,
    @Param('teacherId') teacherId: string,
  ) {
    return this.academicsService.getFacultyTimetable(schoolId, teacherId);
  }

  @Patch('timetable/slot/:id')
  async updateTimetableSlot(
    @Tenant() schoolId: string,
    @Param('id') id: string,
    @Body() body: { subjectId?: string; teacherId?: string; customNote?: string },
  ) {
    return this.academicsService.updateTimetableSlot(schoolId, id, body);
  }

  @Delete('timetable/class/:classId')
  async deleteClassTimetable(
    @Tenant() schoolId: string,
    @Param('classId') classId: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.academicsService.deleteClassTimetable(schoolId, classId, sectionId);
  }
}
