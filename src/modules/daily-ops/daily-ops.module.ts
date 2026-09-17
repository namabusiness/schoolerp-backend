import { Module } from '@nestjs/common';
import { DailyOpsService } from './daily-ops.service';
import { DailyOpsController } from './daily-ops.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DailyOpsController],
  providers: [DailyOpsService],
  exports: [DailyOpsService],
})
export class DailyOpsModule {}
