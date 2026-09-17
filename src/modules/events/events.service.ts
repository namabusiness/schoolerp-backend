import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async getEvents(schoolId: string) {
    return this.prisma.schoolEvent.findMany({
      where: { schoolId },
      orderBy: { eventDate: 'desc' },
    });
  }

  async createEvent(schoolId: string, data: any) {
    return this.prisma.schoolEvent.create({
      data: {
        schoolId,
        title: data.title,
        description: data.description,
        venue: data.venue,
        eventDate: new Date(data.eventDate),
        targetClasses: data.targetClasses,
        participantsCount: Number(data.participantsCount) || 0,
      },
    });
  }
}
