import { Module } from '@nestjs/common';
import { FeesFinanceService } from './fees-finance.service';
import { FeesFinanceController } from './fees-finance.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FeesFinanceController],
  providers: [FeesFinanceService],
  exports: [FeesFinanceService],
})
export class FeesFinanceModule {}
