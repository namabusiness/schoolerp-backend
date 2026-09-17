import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  async getEvents(@Tenant() schoolId: string) {
    return this.eventsService.getEvents(schoolId);
  }

  @Post()
  async createEvent(@Tenant() schoolId: string, @Body() body: any) {
    return this.eventsService.createEvent(schoolId, body);
  }
}
