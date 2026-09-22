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
}

