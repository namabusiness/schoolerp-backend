import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('communication')
@UseGuards(JwtAuthGuard)
export class CommunicationController {
  constructor(private commService: CommunicationService) {}

  @Get('announcements')
  async getAnnouncements(@Tenant() schoolId: string, @Query('audience') audience?: string) {
    return this.commService.getAnnouncements(schoolId, audience);
  }

  @Post('announcements')
  async createAnnouncement(@Tenant() schoolId: string, @Body() body: any) {
    return this.commService.createAnnouncement(schoolId, body);
  }

  // -------------------------------------------------------------
  // PARENT-TEACHER TWO-WAY MESSAGING
  // -------------------------------------------------------------
  @Get('messages')
  async getMessages(
    @Tenant() schoolId: string,
    @Query('studentId') studentId?: string,
    @Query('parentId') parentId?: string,
    @Query('teacherId') teacherId?: string,
  ) {
    return this.commService.getMessages(schoolId, { studentId, parentId, teacherId });
  }

  @Post('messages')
  async sendMessage(@Tenant() schoolId: string, @Body() body: any) {
    return this.commService.sendMessage(schoolId, body);
  }

  @Patch('messages/:id/read')
  async markMessageRead(@Tenant() schoolId: string, @Param('id') id: string) {
    return this.commService.markMessageRead(schoolId, id);
  }
}

