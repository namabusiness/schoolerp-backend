import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FastCacheService } from '../../common/cache/fast-cache.service';

@Injectable()
export class TransportService {
  constructor(
    private prisma: PrismaService,
    private fastCache: FastCacheService,
  ) {}

  private async resolveSchoolId(schoolId: string): Promise<string> {
    if (!schoolId) return 'school-greenwood-high';
    return this.fastCache.getOrSet(`school_id:${schoolId}`, async () => {
      const byId = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (byId) return byId.id;

      const bySlug = await this.prisma.school.findUnique({ where: { slug: schoolId } });
      if (bySlug) return bySlug.id;

      const byPrefix = await this.prisma.school.findUnique({ where: { id: `school-${schoolId}` } });
      if (byPrefix) return byPrefix.id;

      const fallback = await this.prisma.school.findFirst();
      return fallback?.id || 'school-greenwood-high';
    }, 3600);
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

  // -------------------------------------------------------------
  // DRIVER WORKFLOWS & ACTIVE TRIP MANAGEMENT
  // -------------------------------------------------------------

  async getDriverAssignedData(schoolId: string, userIdOrDriverId: string) {
    const cacheKey = `driver_assigned:${schoolId}:${userIdOrDriverId}`;
    return this.fastCache.getOrSet(cacheKey, async () => {
      const resolvedSchoolId = await this.resolveSchoolId(schoolId);

      let driver = await this.prisma.driver.findFirst({
        where: {
          OR: [
            { id: userIdOrDriverId },
            { userId: userIdOrDriverId },
            { user: { email: userIdOrDriverId } },
          ],
        },
      include: {
        vehicles: true,
        routes: {
          include: {
            vehicle: true,
            stops: {
              orderBy: { stopOrder: 'asc' },
              include: {
                assignments: {
                  include: {
                    student: {
                      include: {
                        parent: true,
                        gradeClass: true,
                        section: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!driver) {
      driver = await this.prisma.driver.findFirst({
        where: {
          OR: [{ schoolId: resolvedSchoolId }, { schoolId }],
        },
        include: {
          vehicles: true,
          routes: {
            include: {
              vehicle: true,
              stops: {
                orderBy: { stopOrder: 'asc' },
                include: {
                  assignments: {
                    include: {
                      student: {
                        include: {
                          parent: true,
                          gradeClass: true,
                          section: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    if (!driver) {
      driver = await this.prisma.driver.create({
        data: {
          schoolId: resolvedSchoolId,
          name: 'Murugan Fleet Driver',
          phone: '9840998877',
          licenseNumber: 'DL-TN-2023-8891',
          status: 'ACTIVE',
        },
        include: {
          vehicles: true,
          routes: {
            include: {
              vehicle: true,
              stops: {
                orderBy: { stopOrder: 'asc' },
                include: {
                  assignments: {
                    include: {
                      student: {
                        include: { parent: true, gradeClass: true, section: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    let assignedRoute = driver.routes?.[0] || null;
    if (!assignedRoute) {
      assignedRoute = await this.prisma.route.findFirst({
        where: {
          OR: [{ schoolId: resolvedSchoolId }, { schoolId }],
        },
        include: {
          vehicle: true,
          stops: {
            orderBy: { stopOrder: 'asc' },
            include: {
              assignments: {
                include: {
                  student: {
                    include: {
                      parent: true,
                      gradeClass: true,
                      section: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    let assignedVehicle = assignedRoute?.vehicle || driver.vehicles?.[0] || null;
    if (!assignedVehicle) {
      assignedVehicle = await this.prisma.vehicle.findFirst({
        where: {
          OR: [{ schoolId: resolvedSchoolId }, { schoolId }],
        },
      });
    }
    if (!assignedVehicle) {
      assignedVehicle = await this.prisma.vehicle.create({
        data: {
          schoolId: resolvedSchoolId,
          registrationNo: 'TN-01-AX-9999',
          model: 'Tata Starbus 45',
          capacity: 40,
          vehicleType: 'BUS',
          fuelType: 'DIESEL',
          status: 'ACTIVE',
          driverId: driver.id,
        },
      });
    }

    const students: any[] = [];
    if (assignedRoute?.stops) {
      for (const stop of assignedRoute.stops) {
        for (const assign of stop.assignments || []) {
          students.push({
            id: assign.student.id,
            admissionNumber: assign.student.admissionNumber,
            rollNumber: assign.student.rollNumber,
            firstName: assign.student.firstName,
            lastName: assign.student.lastName,
            fullName: `${assign.student.firstName} ${assign.student.lastName}`.trim(),
            className: assign.student.gradeClass?.name || 'Class',
            sectionName: assign.student.section?.name || 'A',
            stopId: stop.id,
            stopName: stop.stopName,
            stopOrder: stop.stopOrder,
            pickupTime: stop.pickupTime,
            dropTime: stop.dropTime,
            parentName: assign.student.parent?.guardianName || assign.student.parent?.fatherName || 'Parent',
            parentPhone: assign.student.parent?.phone || assign.student.parent?.fatherPhone || 'N/A',
            emergencyPhone: assign.student.parent?.phone || '100',
            bloodGroup: assign.student.bloodGroup || 'O+',
          });
        }
      }
    }

    return {
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        licenseNumber: driver.licenseNumber,
        licenseExpiry: driver.licenseExpiry,
        status: driver.status,
        emergencyContact: driver.emergencyContact,
        photoUrl: driver.photoUrl,
      },
      vehicle: assignedVehicle
        ? {
            id: assignedVehicle.id,
            registrationNo: assignedVehicle.registrationNo,
            model: assignedVehicle.model,
            capacity: assignedVehicle.capacity,
            fuelType: assignedVehicle.fuelType,
            status: assignedVehicle.status,
          }
        : null,
      route: assignedRoute
        ? {
            id: assignedRoute.id,
            name: assignedRoute.name,
            code: assignedRoute.code,
            startLocation: assignedRoute.startLocation,
            endLocation: assignedRoute.endLocation,
            stops: assignedRoute.stops.map((s) => ({
              id: s.id,
              stopName: s.stopName,
              pickupTime: s.pickupTime,
              dropTime: s.dropTime,
              stopOrder: s.stopOrder,
              landmark: s.landmark,
              studentCount: s.assignments?.length || 0,
            })),
          }
        : null,
      students,
      stats: {
        totalStops: assignedRoute?.stops?.length || 0,
        totalStudents: students.length,
        busCapacity: assignedVehicle?.capacity || 40,
      },
    };
    }, 30);
  }

  async getActiveTrip(schoolId: string, userIdOrDriverId: string) {
    const cacheKey = `driver_active_trip:${schoolId}:${userIdOrDriverId}`;
    return this.fastCache.getOrSet(cacheKey, async () => {
      const assigned = await this.getDriverAssignedData(schoolId, userIdOrDriverId);
      const driverId = assigned.driver.id;

      const activeTrip = await this.prisma.tripLog.findFirst({
        where: {
          driverId,
          status: 'IN_PROGRESS',
        },
        include: {
          route: {
            include: {
              stops: { orderBy: { stopOrder: 'asc' } },
              vehicle: true,
            },
          },
          studentStatuses: {
            include: {
              student: {
                include: { parent: true, gradeClass: true, section: true },
              },
              stop: true,
            },
          },
          stopLogs: {
            include: { stop: true },
          },
        },
        orderBy: { startedAt: 'desc' },
      });

      if (!activeTrip) return null;

      return {
        ...activeTrip,
        driver: assigned.driver,
      };
    }, 5);
  }

  async startTrip(
    schoolId: string,
    userIdOrDriverId: string,
    data: { routeId?: string; vehicleId?: string; tripType?: string },
  ) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);
    const assigned = await this.getDriverAssignedData(schoolId, userIdOrDriverId);

    const existingActive = await this.getActiveTrip(schoolId, userIdOrDriverId);
    if (existingActive) {
      return existingActive;
    }

    let routeId = data.routeId || assigned.route?.id;
    if (!routeId) {
      const defaultRoute = await this.prisma.route.findFirst({
        where: { OR: [{ schoolId: resolvedSchoolId }, { schoolId }] },
      });
      routeId = defaultRoute?.id;
    }
    if (!routeId) {
      const createdRoute = await this.prisma.route.create({
        data: {
          schoolId: resolvedSchoolId,
          name: 'Route 101 - North Valley Express',
          code: 'RT-101',
          driverId: assigned.driver.id,
          driverName: assigned.driver.name,
          driverPhone: assigned.driver.phone,
        },
      });
      routeId = createdRoute.id;
    }

    let vehicleId = data.vehicleId || assigned.vehicle?.id;
    if (!vehicleId) {
      const defaultVeh = await this.prisma.vehicle.findFirst({
        where: { OR: [{ schoolId: resolvedSchoolId }, { schoolId }] },
      });
      vehicleId = defaultVeh?.id;
    }
    const tripType = data.tripType || 'MORNING_PICKUP';

    const trip = await this.prisma.tripLog.create({
      data: {
        schoolId: resolvedSchoolId,
        routeId,
        driverId: assigned.driver.id,
        vehicleId,
        tripType,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        date: new Date(),
        currentLatitude: 13.0827,
        currentLongitude: 80.2707,
        currentSpeed: 0,
        currentHeading: 0,
        lastGpsUpdate: new Date(),
      },
    });

    const stops = await this.prisma.routeStop.findMany({
      where: { routeId },
      orderBy: { stopOrder: 'asc' },
    });

    if (stops.length > 0) {
      await this.prisma.tripStopLog.createMany({
        data: stops.map((stop) => ({
          tripId: trip.id,
          stopId: stop.id,
          status: 'PENDING',
        })),
        skipDuplicates: true,
      });
    }

    const assignments = await this.prisma.studentTransportAssignment.findMany({
      where: { routeId },
      include: { student: true },
    });

    if (assignments.length > 0) {
      await this.prisma.tripStudentStatus.createMany({
        data: assignments.map((assign) => ({
          tripId: trip.id,
          studentId: assign.studentId,
          stopId: assign.stopId,
          status: 'WAITING',
        })),
        skipDuplicates: true,
      });
    }

    this.fastCache.delByPrefix(`driver_active_trip:${schoolId}`);
    this.fastCache.delByPrefix(`driver_assigned:${schoolId}`);

    return this.getActiveTrip(schoolId, userIdOrDriverId);
  }

  async updateTripLocation(
    schoolId: string,
    tripId: string,
    coords: { latitude: number; longitude: number; speed?: number; heading?: number },
  ) {
    const existing = await this.prisma.tripLog.findUnique({ where: { id: tripId } });
    if (!existing || existing.status !== 'IN_PROGRESS') {
      return { success: false, message: 'Trip is not currently active.' };
    }
    return this.prisma.tripLog.update({
      where: { id: tripId },
      data: {
        currentLatitude: Number(coords.latitude),
        currentLongitude: Number(coords.longitude),
        currentSpeed: coords.speed !== undefined ? Number(coords.speed) : undefined,
        currentHeading: coords.heading !== undefined ? Number(coords.heading) : undefined,
        lastGpsUpdate: new Date(),
      },
    });
  }

  async updateStopStatus(
    schoolId: string,
    tripId: string,
    stopId: string,
    status: 'REACHED' | 'SKIPPED',
  ) {
    const existing = await this.prisma.tripStopLog.findUnique({
      where: { tripId_stopId: { tripId, stopId } },
    });

    let stopLog;
    if (existing) {
      stopLog = await this.prisma.tripStopLog.update({
        where: { id: existing.id },
        data: {
          status,
          reachedAt: status === 'REACHED' ? new Date() : null,
        },
      });
    } else {
      stopLog = await this.prisma.tripStopLog.create({
        data: {
          tripId,
          stopId,
          status,
          reachedAt: status === 'REACHED' ? new Date() : null,
        },
      });
    }

    if (status === 'REACHED') {
      await this.prisma.tripLog.update({
        where: { id: tripId },
        data: { currentStopId: stopId },
      });
    }

    return stopLog;
  }

  async updateStudentBoardingStatus(
    schoolId: string,
    tripId: string,
    studentId: string,
    status: 'WAITING' | 'BOARDED' | 'DROPPED' | 'ABSENT' | 'SKIPPED',
    remarks?: string,
  ) {
    const existing = await this.prisma.tripStudentStatus.findUnique({
      where: { tripId_studentId: { tripId, studentId } },
    });

    if (existing) {
      return this.prisma.tripStudentStatus.update({
        where: { id: existing.id },
        data: {
          status,
          remarks: remarks || existing.remarks,
          markedAt: new Date(),
        },
      });
    } else {
      const assign = await this.prisma.studentTransportAssignment.findUnique({
        where: { studentId },
      });
      let stopId = assign?.stopId;
      if (!stopId) {
        const trip = await this.prisma.tripLog.findUnique({
          where: { id: tripId },
          include: { route: { include: { stops: { take: 1, orderBy: { stopOrder: 'asc' } } } } },
        });
        stopId = trip?.route?.stops?.[0]?.id;
      }
      if (!stopId) {
        const fallbackStop = await this.prisma.routeStop.findFirst({
          where: { route: { schoolId } },
        });
        stopId = fallbackStop?.id;
      }
      if (!stopId) {
        throw new NotFoundException('Cannot mark student status: no route stop found.');
      }

      return this.prisma.tripStudentStatus.create({
        data: {
          tripId,
          studentId,
          stopId,
          status,
          remarks,
          markedAt: new Date(),
        },
      });
    }
  }

  async endTrip(schoolId: string, tripId: string, notes?: string) {
    this.fastCache.delByPrefix(`driver_active_trip:${schoolId}`);
    this.fastCache.delByPrefix(`driver_assigned:${schoolId}`);

    const existing = await this.prisma.tripLog.findUnique({ where: { id: tripId } });
    if (!existing) {
      return { success: true, message: 'Trip already completed or not found.' };
    }
    return this.prisma.tripLog.update({
      where: { id: tripId },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        notes: notes || 'Trip successfully completed by driver.',
      },
    });
  }

  async reportIncident(schoolId: string, userIdOrDriverId: string, data: any) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);
    const assigned = await this.getDriverAssignedData(schoolId, userIdOrDriverId);

    return this.prisma.transportIncident.create({
      data: {
        schoolId: resolvedSchoolId,
        driverId: assigned.driver.id,
        routeId: data.routeId || assigned.route?.id,
        vehicleId: data.vehicleId || assigned.vehicle?.id,
        tripId: data.tripId || null,
        incidentType: data.incidentType || 'OTHER',
        severity: data.severity || 'MEDIUM',
        description: data.description,
        location: data.location || null,
        latitude: data.latitude ? Number(data.latitude) : null,
        longitude: data.longitude ? Number(data.longitude) : null,
        status: 'REPORTED',
      },
    });
  }

  async getDriverIncidents(schoolId: string, userIdOrDriverId: string) {
    const assigned = await this.getDriverAssignedData(schoolId, userIdOrDriverId);
    return this.prisma.transportIncident.findMany({
      where: { driverId: assigned.driver.id },
      orderBy: { reportedAt: 'desc' },
      take: 20,
    });
  }

  async logVehicleInspection(schoolId: string, userIdOrDriverId: string, data: any) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);
    const assigned = await this.getDriverAssignedData(schoolId, userIdOrDriverId);

    let vehicleId = data.vehicleId || assigned.vehicle?.id;
    if (!vehicleId) {
      const defaultVeh = await this.prisma.vehicle.findFirst({
        where: { OR: [{ schoolId: resolvedSchoolId }, { schoolId }] },
      });
      vehicleId = defaultVeh?.id;
    }
    if (!vehicleId) {
      const createdVeh = await this.prisma.vehicle.create({
        data: {
          schoolId: resolvedSchoolId,
          registrationNo: 'TN-01-AX-9999',
          model: 'Tata Starbus 45',
          capacity: 40,
          vehicleType: 'BUS',
          fuelType: 'DIESEL',
          status: 'ACTIVE',
          driverId: assigned.driver.id,
        },
      });
      vehicleId = createdVeh.id;
    }

    return this.prisma.vehicleInspectionLog.create({
      data: {
        schoolId: resolvedSchoolId,
        vehicleId,
        driverId: assigned.driver.id,
        odometerReading: data.odometerReading ? Number(data.odometerReading) : null,
        fuelLiters: data.fuelLiters ? Number(data.fuelLiters) : null,
        fuelCost: data.fuelCost ? Number(data.fuelCost) : null,
        engineOilCheck: data.engineOilCheck ?? true,
        tirePressureCheck: data.tirePressureCheck ?? true,
        brakesCheck: data.brakesCheck ?? true,
        lightsCheck: data.lightsCheck ?? true,
        emergencyDoorCheck: data.emergencyDoorCheck ?? true,
        firstAidKitCheck: data.firstAidKitCheck ?? true,
        cleanlinessCheck: data.cleanlinessCheck ?? true,
        notes: data.notes || null,
      },
    });
  }

  async getVehicleInspections(schoolId: string, userIdOrDriverId: string) {
    const assigned = await this.getDriverAssignedData(schoolId, userIdOrDriverId);
    return this.prisma.vehicleInspectionLog.findMany({
      where: { driverId: assigned.driver.id },
      include: { vehicle: true },
      orderBy: { inspectionDate: 'desc' },
      take: 20,
    });
  }
}

