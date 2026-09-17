import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommunicationService {
  constructor(private prisma: PrismaService) {}

  async getAnnouncements(schoolId: string, audience?: string) {
    const where: any = { schoolId };
    if (audience) where.audience = audience;
    return this.prisma.announcement.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
    });
  }

  async createAnnouncement(schoolId: string, data: any) {
    const channels = data.channels || ['IN_APP', 'EMAIL'];
    return this.prisma.announcement.create({
      data: {
        schoolId,
        title: data.title,
        content: data.content,
        audience: data.audience || 'ALL',
        targetGrade: data.targetGrade,
        channels: JSON.stringify(channels),
        authorName: data.authorName || 'School Administration',
      },
    });
  }
}
