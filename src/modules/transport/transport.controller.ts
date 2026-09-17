import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TransportService } from './transport.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('transport')
@UseGuards(JwtAuthGuard)
export class TransportController {
  constructor(private transportService: TransportService) {}

  @Get('vehicles')
  async getVehicles(@Tenant() schoolId: string) {
    return this.transportService.getVehicles(schoolId);
  }

  @Post('vehicles')
  async createVehicle(@Tenant() schoolId: string, @Body() body: any) {
    return this.transportService.createVehicle(schoolId, body);
  }

  @Get('routes')
  async getRoutes(@Tenant() schoolId: string) {
    return this.transportService.getRoutes(schoolId);
  }

  @Post('routes')
  async createRoute(@Tenant() schoolId: string, @Body() body: any) {
    return this.transportService.createRoute(schoolId, body);
  }

  @Post('assign-student')
  async assignStudent(@Tenant() schoolId: string, @Body() body: any) {
    return this.transportService.assignStudent(schoolId, body);
  }

  @Get('trips')
  async getTripLogs(@Tenant() schoolId: string) {
    return this.transportService.getTripLogs(schoolId);
  }

  @Post('trips')
  async logTrip(@Tenant() schoolId: string, @Body() body: any) {
    return this.transportService.logTrip(schoolId, body);
  }
}
