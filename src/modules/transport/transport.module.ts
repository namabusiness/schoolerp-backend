import { Module } from '@nestjs/common';
import { TransportService } from './transport.service';
import { TransportController } from './transport.controller';
import { AuthModule } from '../auth/auth.module';
import { DriverAuthGuard } from './guards/driver-auth.guard';

@Module({
  imports: [AuthModule],
  controllers: [TransportController],
  providers: [TransportService, DriverAuthGuard],
  exports: [TransportService],
})
export class TransportModule {}
