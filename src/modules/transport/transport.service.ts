import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationUpdateDto } from './dto/location-update.dto';
import { StartTripDto } from './dto/start-trip.dto';
import { TripStatus } from '@prisma/client';

@Injectable()
export class TransportService {
  constructor(private prisma: PrismaService) {}

  private readonly tripInclude = {
    driver: true,
    vehicle: true,
    route: {
      include: { stops: { orderBy: { stopOrder: 'asc' as const } } },
    },
  } as const;

  private async getDriverForUser(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true, schoolId: true, isActive: true } } },
    });
    if (!driver || !driver.user || driver.user.schoolId !== driver.schoolId || !driver.user.isActive) {
      throw new ForbiddenException('Driver assignment is inactive or unavailable');
    }
    return driver;
  }

  async getDriverAssignment(userId: string) {
    const driver = await this.getDriverForUser(userId);
    const [school, routes, vehicles] = await Promise.all([
      this.prisma.school.findUnique({
        where: { id: driver.schoolId },
        select: { id: true, name: true, code: true, slug: true, logoUrl: true },
      }),
      this.prisma.route.findMany({
        where: { schoolId: driver.schoolId, driverId: driver.id },
        include: { vehicle: true, stops: { orderBy: { stopOrder: 'asc' } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.vehicle.findMany({
        where: { schoolId: driver.schoolId, driverId: driver.id },
        orderBy: { registrationNo: 'asc' },
      }),
    ]);

    return {
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        licenseNumber: driver.licenseNumber,
        licenseExpiry: driver.licenseExpiry,
        experienceYears: driver.experienceYears,
        status: driver.status,
        photoUrl: driver.photoUrl,
      },
      school,
      vehicles,
      routes,
    };
  }

  async startDriverTrip(userId: string, data: StartTripDto) {
    const driver = await this.getDriverForUser(userId);
    return this.prisma.$transaction(async (tx) => {
      const activeTrip = await tx.trip.findFirst({
        where: { schoolId: driver.schoolId, driverId: driver.id, status: TripStatus.ACTIVE },
        select: { id: true },
      });
      if (activeTrip) throw new ConflictException('Driver already has an active trip');

      const route = await tx.route.findFirst({
        where: { id: data.routeId, schoolId: driver.schoolId, driverId: driver.id },
      });
      if (!route) throw new ForbiddenException('Route is not assigned to this driver');

      const vehicleId = data.vehicleId || route.vehicleId;
      if (!vehicleId) throw new ConflictException('Route has no assigned vehicle');
      const vehicle = await tx.vehicle.findFirst({
        where: { id: vehicleId, schoolId: driver.schoolId, driverId: driver.id },
      });
      if (!vehicle) throw new ForbiddenException('Vehicle is not assigned to this driver');
      if (route.vehicleId && route.vehicleId !== vehicle.id) {
        throw new ConflictException('Vehicle does not match the route assignment');
      }

      const activeVehicleTrip = await tx.trip.findFirst({
        where: { schoolId: driver.schoolId, vehicleId: vehicle.id, status: TripStatus.ACTIVE },
        select: { id: true },
      });
      if (activeVehicleTrip) throw new ConflictException('Vehicle already has an active trip');

      return tx.trip.create({
        data: {
          schoolId: driver.schoolId,
          driverId: driver.id,
          vehicleId: vehicle.id,
          routeId: route.id,
          tripType: data.tripType,
        },
        include: this.tripInclude,
      });
    });
  }

  async getCurrentDriverTrip(userId: string) {
    const driver = await this.getDriverForUser(userId);
    const trip = await this.prisma.trip.findFirst({
      where: { schoolId: driver.schoolId, driverId: driver.id, status: TripStatus.ACTIVE },
      include: this.tripInclude,
    });
    if (!trip) throw new NotFoundException('No active trip found');
    return trip;
  }

  async updateDriverTripLocation(userId: string, tripId: string, data: LocationUpdateDto) {
    const driver = await this.getDriverForUser(userId);
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.schoolId !== driver.schoolId || trip.driverId !== driver.id) {
      throw new ForbiddenException('Trip is not assigned to this driver');
    }
    if (trip.status !== TripStatus.ACTIVE) throw new ConflictException('Trip is not active');

    return this.prisma.$transaction(async (tx) => {
      await tx.tripLocation.create({
        data: {
          tripId: trip.id,
          schoolId: driver.schoolId,
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy,
          speed: data.speed,
          heading: data.heading,
          recordedAt: data.timestamp,
        },
      });
      return tx.trip.update({
        where: { id: trip.id },
        data: {
          latestLatitude: data.latitude,
          latestLongitude: data.longitude,
          latestAccuracy: data.accuracy,
          latestSpeed: data.speed,
          latestHeading: data.heading,
          latestLocationAt: data.timestamp,
        },
        include: this.tripInclude,
      });
    });
  }

  async endDriverTrip(userId: string, tripId: string) {
    const driver = await this.getDriverForUser(userId);
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.schoolId !== driver.schoolId || trip.driverId !== driver.id) {
      throw new ForbiddenException('Trip is not assigned to this driver');
    }
    if (trip.status !== TripStatus.ACTIVE) throw new ConflictException('Trip is already completed');

    return this.prisma.trip.update({
      where: { id: trip.id },
      data: { status: TripStatus.COMPLETED, endedAt: new Date() },
      select: { id: true, status: true, startedAt: true, endedAt: true },
    });
  }

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
}
