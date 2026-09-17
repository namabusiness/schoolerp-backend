import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TransportService {
  constructor(private prisma: PrismaService) {}

  async getVehicles(schoolId: string) {
    return this.prisma.vehicle.findMany({
      where: { schoolId },
      include: { routes: true },
    });
  }

  async createVehicle(schoolId: string, data: any) {
    return this.prisma.vehicle.create({
      data: {
        schoolId,
        registrationNo: data.registrationNo.toUpperCase(),
        model: data.model,
        capacity: Number(data.capacity),
        status: data.status || 'ACTIVE',
      },
    });
  }

  async getRoutes(schoolId: string) {
    return this.prisma.route.findMany({
      where: { schoolId },
      include: {
        vehicle: true,
        stops: { orderBy: { stopOrder: 'asc' } },
        _count: { select: { studentAssignments: true } },
      },
    });
  }

  async createRoute(schoolId: string, data: any) {
    return this.prisma.route.create({
      data: {
        schoolId,
        name: data.name,
        vehicleId: data.vehicleId,
        driverName: data.driverName,
        driverPhone: data.driverPhone,
        stops: data.stops
          ? {
              create: data.stops.map((s: any, idx: number) => ({
                schoolId,
                stopName: s.stopName,
                pickupTime: s.pickupTime,
                dropTime: s.dropTime,
                stopOrder: idx + 1,
              })),
            }
          : undefined,
      },
    });
  }

  async assignStudent(schoolId: string, data: { studentId: string; routeId: string; stopId: string }) {
    return this.prisma.studentTransportAssignment.upsert({
      where: { studentId: data.studentId },
      create: {
        schoolId,
        studentId: data.studentId,
        routeId: data.routeId,
        stopId: data.stopId,
      },
      update: {
        routeId: data.routeId,
        stopId: data.stopId,
      },
    });
  }

  async getTripLogs(schoolId: string) {
    return this.prisma.tripLog.findMany({
      where: { schoolId },
      include: { route: true },
      orderBy: { date: 'desc' },
      take: 50,
    });
  }

  async logTrip(schoolId: string, data: any) {
    return this.prisma.tripLog.create({
      data: {
        schoolId,
        routeId: data.routeId,
        tripType: data.tripType,
        date: new Date(),
        status: data.status || 'COMPLETED',
        notes: data.notes,
      },
    });
  }
}
