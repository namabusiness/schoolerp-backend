import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
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
}
