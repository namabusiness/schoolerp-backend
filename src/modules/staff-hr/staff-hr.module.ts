import { Module } from '@nestjs/common';
import { StaffHrService } from './staff-hr.service';
import { StaffHrController } from './staff-hr.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StaffHrController],
  providers: [StaffHrService],
  exports: [StaffHrService],
})
export class StaffHrModule {}
