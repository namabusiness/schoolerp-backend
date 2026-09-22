import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TransportService {
  constructor(private prisma: PrismaService) {}

  private async resolveSchoolId(schoolId: string): Promise<string> {
    if (!schoolId) return 'school-greenwood-high';
    const byId = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (byId) return byId.id;

    const bySlug = await this.prisma.school.findUnique({ where: { slug: schoolId } });
    if (bySlug) return bySlug.id;

    const byPrefix = await this.prisma.school.findUnique({ where: { id: `school-${schoolId}` } });
    if (byPrefix) return byPrefix.id;

    const fallback = await this.prisma.school.findFirst();
    return fallback?.id || 'school-greenwood-high';
  }

  // -------------------------------------------------------------
  // DRIVERS
  // -------------------------------------------------------------
  async getDrivers(schoolId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.driver.findMany({
      where: {
        OR: [{ schoolId: resolvedId }, { schoolId }],
      },
      include: {
        vehicles: true,
        routes: true,
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDriver(schoolId: string, data: any) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.driver.create({
      data: {
        schoolId: resolvedId,
        name: data.name,
        phone: data.phone,
        licenseNumber: data.licenseNumber,
        licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : null,
        experienceYears: data.experienceYears ? Number(data.experienceYears) : 0,
        status: data.status || 'ACTIVE',
        photoUrl: data.photoUrl || null,
        address: data.address || null,
        emergencyContact: data.emergencyContact || null,
      },
    });
  }

  async updateDriver(schoolId: string, id: string, data: any) {
    return this.prisma.driver.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        licenseNumber: data.licenseNumber,
        licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : undefined,
        experienceYears: data.experienceYears !== undefined ? Number(data.experienceYears) : undefined,
        status: data.status,
        photoUrl: data.photoUrl,
        address: data.address,
        emergencyContact: data.emergencyContact,
      },
    });
  }

  async deleteDriver(schoolId: string, id: string) {
    return this.prisma.driver.delete({
      where: { id },
    });
  }

  // -------------------------------------------------------------
  // VEHICLES
  // -------------------------------------------------------------
  async getVehicles(schoolId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.vehicle.findMany({
      where: {
        OR: [{ schoolId: resolvedId }, { schoolId }],
      },
      include: {
        routes: true,
        driver: true,
      },
      orderBy: { registrationNo: 'asc' },
    });
  }

  async createVehicle(schoolId: string, data: any) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.vehicle.create({
      data: {
        schoolId: resolvedId,
        registrationNo: data.registrationNo.toUpperCase(),
        model: data.model,
        capacity: Number(data.capacity),
        vehicleType: data.vehicleType || 'BUS',
        driverId: data.driverId || null,
        fuelType: data.fuelType || 'DIESEL',
        status: data.status || 'ACTIVE',
        insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : null,
        pollutionExpiry: data.pollutionExpiry ? new Date(data.pollutionExpiry) : null,
        fitnessExpiry: data.fitnessExpiry ? new Date(data.fitnessExpiry) : null,
      },
      include: { driver: true },
    });
  }

  async updateVehicle(schoolId: string, id: string, data: any) {
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        registrationNo: data.registrationNo ? data.registrationNo.toUpperCase() : undefined,
        model: data.model,
        capacity: data.capacity !== undefined ? Number(data.capacity) : undefined,
        vehicleType: data.vehicleType,
        driverId: data.driverId !== undefined ? data.driverId : undefined,
        fuelType: data.fuelType,
        status: data.status,
      },
      include: { driver: true },
    });
  }

  async deleteVehicle(schoolId: string, id: string) {
    return this.prisma.vehicle.delete({
      where: { id },
    });
  }

  // -------------------------------------------------------------
  // ROUTES & STOPS
  // -------------------------------------------------------------
  async getRoutes(schoolId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.route.findMany({
      where: {
        OR: [{ schoolId: resolvedId }, { schoolId }],
      },
      include: {
        vehicle: true,
        driver: true,
        inchargeStaff: {
          select: {
            id: true,
            name: true,
            designation: true,
            phone: true,
            email: true,
            photoUrl: true,
          },
        },
        stops: { orderBy: { stopOrder: 'asc' } },
        studentAssignments: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                studentPhotoUrl: true,
                gradeClass: { select: { name: true } },
                section: { select: { name: true } },
                parent: { select: { phone: true, fatherName: true, motherName: true } },
              },
            },
            stop: true,
          },
        },
        _count: { select: { studentAssignments: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createRoute(schoolId: string, data: any) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    let driverName = data.driverName;
    let driverPhone = data.driverPhone;

    if (data.driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { id: data.driverId } });
      if (driver) {
        driverName = driver.name;
        driverPhone = driver.phone;
      }
    }

    return this.prisma.route.create({
      data: {
        schoolId: resolvedId,
        name: data.name,
        code: data.code || null,
        startLocation: data.startLocation || null,
        endLocation: data.endLocation || null,
        vehicleId: data.vehicleId || null,
        driverId: data.driverId || null,
        inchargeStaffId: data.inchargeStaffId || null,
        driverName,
        driverPhone,
        stops: data.stops && data.stops.length > 0
          ? {
              create: data.stops.map((s: any, idx: number) => ({
                schoolId: resolvedId,
                stopName: s.stopName,
                pickupTime: s.pickupTime,
                dropTime: s.dropTime,
                stopOrder: s.stopOrder ? Number(s.stopOrder) : idx + 1,
                landmark: s.landmark || null,
                fare: s.fare ? Number(s.fare) : 0,
              })),
            }
          : undefined,
      },
      include: {
        vehicle: true,
        driver: true,
        inchargeStaff: true,
        stops: { orderBy: { stopOrder: 'asc' } },
        _count: { select: { studentAssignments: true } },
      },
    });
  }

  async updateRouteIncharge(schoolId: string, routeId: string, inchargeStaffId: string | null) {
    return this.prisma.route.update({
      where: { id: routeId },
      data: {
        inchargeStaffId: inchargeStaffId || null,
      },
      include: {
        inchargeStaff: true,
      },
    });
  }

  async deleteRoute(schoolId: string, id: string) {
    return this.prisma.route.delete({
      where: { id },
    });
  }

  async addRouteStop(schoolId: string, routeId: string, data: any) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const highestStop = await this.prisma.routeStop.findFirst({
      where: { routeId },
      orderBy: { stopOrder: 'desc' },
    });
    const nextOrder = data.stopOrder
      ? Number(data.stopOrder)
      : highestStop
      ? highestStop.stopOrder + 1
      : 1;

    return this.prisma.routeStop.create({
      data: {
        schoolId: resolvedId,
        routeId,
        stopName: data.stopName,
        pickupTime: data.pickupTime,
        dropTime: data.dropTime,
        stopOrder: nextOrder,
        landmark: data.landmark || null,
        fare: data.fare ? Number(data.fare) : 0,
      },
    });
  }

  async deleteRouteStop(schoolId: string, routeId: string, stopId: string) {
    return this.prisma.routeStop.delete({
      where: { id: stopId },
    });
  }

  // -------------------------------------------------------------
  // STUDENT ASSIGNMENT & TRIPS
  // -------------------------------------------------------------
  async assignStudent(schoolId: string, data: { studentId: string; routeId: string; stopId: string }) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.studentTransportAssignment.upsert({
      where: { studentId: data.studentId },
      create: {
        schoolId: resolvedId,
        studentId: data.studentId,
        routeId: data.routeId,
        stopId: data.stopId,
      },
      update: {
        schoolId: resolvedId,
        routeId: data.routeId,
        stopId: data.stopId,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            gradeClass: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
        stop: true,
      },
    });
  }

  async unassignStudent(schoolId: string, studentId: string) {
    return this.prisma.studentTransportAssignment.delete({
      where: { studentId },
    });
  }

  async getTripLogs(schoolId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.tripLog.findMany({
      where: {
        OR: [{ schoolId: resolvedId }, { schoolId }],
      },
      include: { route: true },
      orderBy: { date: 'desc' },
      take: 50,
    });
  }

  async logTrip(schoolId: string, data: any) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    return this.prisma.tripLog.create({
      data: {
        schoolId: resolvedId,
        routeId: data.routeId,
        tripType: data.tripType,
        date: new Date(),
        status: data.status || 'COMPLETED',
        notes: data.notes,
      },
    });
  }

  // -------------------------------------------------------------
  // ISOLATED STUDENT TRANSPORT DETAILS FOR PARENT
  // -------------------------------------------------------------
  async getStudentTransport(schoolId: string, studentId: string) {
    const resolvedId = await this.resolveSchoolId(schoolId);
    const assignment = await this.prisma.studentTransportAssignment.findFirst({
      where: {
        studentId,
        OR: [{ schoolId: resolvedId }, { schoolId }],
      },
      include: {
        route: {
          include: {
            vehicle: true,
            driver: true,
            stops: { orderBy: { stopOrder: 'asc' } },
            trips: { orderBy: { date: 'desc' }, take: 5 },
          },
        },
        stop: true,
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      },
    });

    if (!assignment) {
      return { isAssigned: false, message: 'No transport assignment found for this student.' };
    }

    const latestTrip = assignment.route.trips?.[0] || null;

    return {
      isAssigned: true,
      student: assignment.student,
      route: {
        id: assignment.route.id,
        name: assignment.route.name,
        code: assignment.route.code,
        startLocation: assignment.route.startLocation,
        endLocation: assignment.route.endLocation,
      },
      stop: {
        id: assignment.stop.id,
        name: assignment.stop.stopName,
        pickupTime: assignment.stop.pickupTime,
        dropTime: assignment.stop.dropTime,
        landmark: assignment.stop.landmark,
        order: assignment.stop.stopOrder,
      },
      vehicle: assignment.route.vehicle
        ? {
            id: assignment.route.vehicle.id,
            registrationNo: assignment.route.vehicle.registrationNo,
            model: assignment.route.vehicle.model,
            capacity: assignment.route.vehicle.capacity,
            type: assignment.route.vehicle.vehicleType,
            status: assignment.route.vehicle.status,
          }
        : null,
      driver: assignment.route.driver
        ? {
            name: assignment.route.driver.name,
            phone: assignment.route.driver.phone,
            photoUrl: assignment.route.driver.photoUrl,
            status: assignment.route.driver.status,
          }
        : {
            name: assignment.route.driverName || 'Designated Fleet Driver',
            phone: assignment.route.driverPhone || 'Contact School Transport Desk',
          },
      latestTrip: latestTrip
        ? {
            tripType: latestTrip.tripType,
            status: latestTrip.status,
            date: latestTrip.date,
            notes: latestTrip.notes,
          }
        : {
            tripType: 'MORNING_PICKUP',
            status: 'SCHEDULED',
            notes: 'Operating on daily scheduled route timing',
          },
    };
  }
}

