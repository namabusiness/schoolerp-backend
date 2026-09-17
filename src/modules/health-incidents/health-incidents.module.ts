import { Module } from '@nestjs/common';
import { HealthIncidentsService } from './health-incidents.service';
import { HealthIncidentsController } from './health-incidents.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HealthIncidentsController],
  providers: [HealthIncidentsService],
  exports: [HealthIncidentsService],
})
export class HealthIncidentsModule {}
