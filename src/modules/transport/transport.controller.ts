import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TransportService } from './transport.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('transport')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransportController {
  constructor(private transportService: TransportService) {}

  // Drivers
  @Get('drivers')
  async getDrivers(@Tenant() schoolId: string) {
    return this.transportService.getDrivers(schoolId);
  }

  @Post('drivers')
  async createDriver(@Tenant() schoolId: string, @Body() body: any) {
    return this.transportService.createDriver(schoolId, body);
  }

  @Patch('drivers/:id')
  async updateDriver(@Tenant() schoolId: string, @Param('id') id: string, @Body() body: any) {
    return this.transportService.updateDriver(schoolId, id, body);
  }

  @Delete('drivers/:id')
  async deleteDriver(@Tenant() schoolId: string, @Param('id') id: string) {
    return this.transportService.deleteDriver(schoolId, id);
  }

  // Vehicles
  @Get('vehicles')
  async getVehicles(@Tenant() schoolId: string) {
    return this.transportService.getVehicles(schoolId);
  }

  @Post('vehicles')
  async createVehicle(@Tenant() schoolId: string, @Body() body: any) {
    return this.transportService.createVehicle(schoolId, body);
  }

  @Patch('vehicles/:id')
  async updateVehicle(@Tenant() schoolId: string, @Param('id') id: string, @Body() body: any) {
    return this.transportService.updateVehicle(schoolId, id, body);
  }

  @Delete('vehicles/:id')
  async deleteVehicle(@Tenant() schoolId: string, @Param('id') id: string) {
    return this.transportService.deleteVehicle(schoolId, id);
  }

  // Routes
  @Get('routes')
  async getRoutes(@Tenant() schoolId: string) {
    return this.transportService.getRoutes(schoolId);
  }

  @Post('routes')
  async createRoute(@Tenant() schoolId: string, @Body() body: any) {
    return this.transportService.createRoute(schoolId, body);
  }

  @Delete('routes/:id')
  async deleteRoute(@Tenant() schoolId: string, @Param('id') id: string) {
    return this.transportService.deleteRoute(schoolId, id);
  }

  // Stops
  @Post('routes/:routeId/stops')
  async addRouteStop(@Tenant() schoolId: string, @Param('routeId') routeId: string, @Body() body: any) {
    return this.transportService.addRouteStop(schoolId, routeId, body);
  }

  @Delete('routes/:routeId/stops/:stopId')
  async deleteRouteStop(
    @Tenant() schoolId: string,
    @Param('routeId') routeId: string,
    @Param('stopId') stopId: string,
  ) {
    return this.transportService.deleteRouteStop(schoolId, routeId, stopId);
  }

  // -------------------------------------------------------------
  // RESTRICTED: PRINCIPAL & TRANSPORT MANAGER ONLY
  // -------------------------------------------------------------

  // Assign / Update Incharge Faculty on Route
  @Patch('routes/:id/incharge')
  @Roles(Role.PRINCIPAL, Role.TRANSPORT_MANAGER, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async updateRouteIncharge(
    @Tenant() schoolId: string,
    @Param('id') routeId: string,
    @Body('inchargeStaffId') inchargeStaffId: string | null,
  ) {
    return this.transportService.updateRouteIncharge(schoolId, routeId, inchargeStaffId);
  }

  // Assign Student to Route & Stop
  @Post('assign-student')
  @Roles(Role.PRINCIPAL, Role.TRANSPORT_MANAGER, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async assignStudent(@Tenant() schoolId: string, @Body() body: any) {
    return this.transportService.assignStudent(schoolId, body);
  }

  // Remove / Unassign Student from Route
  @Delete('unassign-student/:studentId')
  @Roles(Role.PRINCIPAL, Role.TRANSPORT_MANAGER, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async unassignStudent(@Tenant() schoolId: string, @Param('studentId') studentId: string) {
    return this.transportService.unassignStudent(schoolId, studentId);
  }

  @Get('trips')
  async getTripLogs(@Tenant() schoolId: string) {
    return this.transportService.getTripLogs(schoolId);
  }

  @Post('trips')
  async logTrip(@Tenant() schoolId: string, @Body() body: any) {
    return this.transportService.logTrip(schoolId, body);
  }

  // Isolated student transport for parent tracking
  @Get('student/:studentId')
  async getStudentTransport(
    @Tenant() schoolId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.transportService.getStudentTransport(schoolId, studentId);
  }

  // -------------------------------------------------------------
  // DRIVER WORKFLOWS & ACTIVE TRIP MANAGEMENT
  // -------------------------------------------------------------

  /**
   * Fetch authenticated driver's assigned vehicle, route, stops, and student passenger roster.
   * Auto-resolves default fleet resources if no explicit assignment exists.
   */
  @Get('driver/assigned')
  @Roles(Role.DRIVER, Role.TRANSPORT_MANAGER, Role.TRANSPORT_ADMIN, Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getDriverAssigned(
    @Tenant() schoolId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.transportService.getDriverAssignedData(schoolId, userId);
  }

  /**
   * Fetch driver's current IN_PROGRESS trip session with real-time stops and passenger status.
   */
  @Get('driver/active-trip')
  @Roles(Role.DRIVER, Role.TRANSPORT_MANAGER, Role.TRANSPORT_ADMIN, Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getDriverActiveTrip(
    @Tenant() schoolId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.transportService.getActiveTrip(schoolId, userId);
  }

  /**
   * Start an assigned transit trip (Morning Pickup, Afternoon Drop, or Special Trip).
   * Automatically initializes route milestone logs and student boarding checklists.
   */
  @Post('driver/trips/start')
  @Roles(Role.DRIVER, Role.TRANSPORT_MANAGER, Role.TRANSPORT_ADMIN, Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async startDriverTrip(
    @Tenant() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { routeId?: string; vehicleId?: string; tripType?: string },
  ) {
    return this.transportService.startTrip(schoolId, userId, body);
  }

  /**
   * Broadcast live GPS telemetry coordinates, speed (km/h), and compass heading.
   * Feeds the live bus tracking system for parents and transport dispatch.
   */
  @Post('driver/trips/:tripId/location')
  @Roles(Role.DRIVER, Role.TRANSPORT_MANAGER, Role.TRANSPORT_ADMIN, Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async updateTripLocation(
    @Tenant() schoolId: string,
    @Param('tripId') tripId: string,
    @Body() body: { latitude: number; longitude: number; speed?: number; heading?: number },
  ) {
    return this.transportService.updateTripLocation(schoolId, tripId, body);
  }

  /**
   * Record stop arrival status (REACHED / SKIPPED) along the route.
   */
  @Post('driver/trips/:tripId/stops/:stopId/status')
  @Roles(Role.DRIVER, Role.TRANSPORT_MANAGER, Role.TRANSPORT_ADMIN, Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async updateTripStopStatus(
    @Tenant() schoolId: string,
    @Param('tripId') tripId: string,
    @Param('stopId') stopId: string,
    @Body('status') status: 'REACHED' | 'SKIPPED',
  ) {
    return this.transportService.updateStopStatus(schoolId, tripId, stopId, status);
  }

  /**
   * Record student boarding check-in: WAITING, BOARDED, DROPPED, ABSENT, or SKIPPED.
   * Dynamically maps to student's designated stop.
   */
  @Post('driver/trips/:tripId/students/:studentId/status')
  @Roles(Role.DRIVER, Role.TRANSPORT_MANAGER, Role.TRANSPORT_ADMIN, Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async updateTripStudentStatus(
    @Tenant() schoolId: string,
    @Param('tripId') tripId: string,
    @Param('studentId') studentId: string,
    @Body() body: { status: 'WAITING' | 'BOARDED' | 'DROPPED' | 'ABSENT' | 'SKIPPED'; remarks?: string },
  ) {
    return this.transportService.updateStudentBoardingStatus(
      schoolId,
      tripId,
      studentId,
      body.status,
      body.remarks,
    );
  }

  /**
   * Conclude and archive the active trip session with driver closing remarks.
   */
  @Post('driver/trips/:tripId/end')
  @Roles(Role.DRIVER, Role.TRANSPORT_MANAGER, Role.TRANSPORT_ADMIN, Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async endDriverTrip(
    @Tenant() schoolId: string,
    @Param('tripId') tripId: string,
    @Body('notes') notes?: string,
  ) {
    return this.transportService.endTrip(schoolId, tripId, notes);
  }

  /**
   * Report emergency SOS incident (breakdown, traffic accident, medical emergency, delay).
   * Instantly notifies the school transport desk with live GPS coordinates.
   */
  @Post('driver/incidents')
  @Roles(Role.DRIVER, Role.TRANSPORT_MANAGER, Role.TRANSPORT_ADMIN, Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async reportIncident(
    @Tenant() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body() body: any,
  ) {
    return this.transportService.reportIncident(schoolId, userId, body);
  }

  /**
   * Fetch recent emergency incidents reported by the driver.
   */
  @Get('driver/incidents')
  @Roles(Role.DRIVER, Role.TRANSPORT_MANAGER, Role.TRANSPORT_ADMIN, Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getDriverIncidents(
    @Tenant() schoolId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.transportService.getDriverIncidents(schoolId, userId);
  }

  /**
   * Log mandatory pre-trip vehicle roadworthiness checklist and fuel entry.
   * Auto-resolves vehicle ID fallback so unassigned or admin users never encounter 404 errors.
   */
  @Post('driver/inspections')
  @Roles(Role.DRIVER, Role.TRANSPORT_MANAGER, Role.TRANSPORT_ADMIN, Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async logVehicleInspection(
    @Tenant() schoolId: string,
    @CurrentUser('id') userId: string,
    @Body() body: any,
  ) {
    return this.transportService.logVehicleInspection(schoolId, userId, body);
  }

  /**
   * Retrieve pre-trip vehicle inspection history.
   */
  @Get('driver/inspections')
  @Roles(Role.DRIVER, Role.TRANSPORT_MANAGER, Role.TRANSPORT_ADMIN, Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getVehicleInspections(
    @Tenant() schoolId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.transportService.getVehicleInspections(schoolId, userId);
  }
}

