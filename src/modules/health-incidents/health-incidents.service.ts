import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthIncidentsService {
  constructor(private prisma: PrismaService) {}

  async getIncidents(schoolId: string, studentId?: string) {
    const where: any = { schoolId };
    if (studentId) where.studentId = studentId;
    return this.prisma.incidentLog.findMany({
      where,
      include: { student: { include: { gradeClass: true, section: true } } },
      orderBy: { dateTime: 'desc' },
    });
  }

  async logIncident(schoolId: string, data: any) {
    return this.prisma.incidentLog.create({
      data: {
        schoolId,
        studentId: data.studentId,
        dateTime: data.dateTime ? new Date(data.dateTime) : new Date(),
        location: data.location || 'School Campus',
        incidentType: data.incidentType || 'General',
        description: data.description,
        staffInvolved: data.staffInvolved || 'Staff on duty',
        actionTaken: data.actionTaken,
        parentNotified: Boolean(data.parentNotified),
      },
    });
  }

  async getHealthRecord(schoolId: string, studentId: string) {
    return this.prisma.healthRecord.findFirst({
      where: { schoolId, studentId },
    });
  }

  async updateHealthRecord(schoolId: string, studentId: string, data: any) {
    return this.prisma.healthRecord.upsert({
      where: { studentId },
      create: {
        schoolId,
        studentId,
        bloodGroup: data.bloodGroup,
        allergies: data.allergies,
        conditions: data.conditions,
        emergencyPhone: data.emergencyPhone,
      },
      update: {
        bloodGroup: data.bloodGroup,
        allergies: data.allergies,
        conditions: data.conditions,
        emergencyPhone: data.emergencyPhone,
      },
    });
  }
}
