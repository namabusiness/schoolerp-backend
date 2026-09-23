import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';

// Core Services
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { RedisModule } from './common/redis/redis.module';
import { FastCacheModule } from './common/cache/fast-cache.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

// Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { AcademicsModule } from './modules/academics/academics.module';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { StudentsModule } from './modules/students/students.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { DailyOpsModule } from './modules/daily-ops/daily-ops.module';
import { HomeworkModule } from './modules/homework/homework.module';
import { ExaminationsModule } from './modules/examinations/examinations.module';
import { FeesFinanceModule } from './modules/fees-finance/fees-finance.module';
import { TransportModule } from './modules/transport/transport.module';
import { LibraryModule } from './modules/library/library.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { StaffHrModule } from './modules/staff-hr/staff-hr.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { EventsModule } from './modules/events/events.module';
import { HealthIncidentsModule } from './modules/health-incidents/health-incidents.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { PromotionModule } from './modules/promotion/promotion.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    RedisModule,
    FastCacheModule,
    AuthModule,
    SuperAdminModule,
    AcademicsModule,
    AdmissionsModule,
    StudentsModule,
    AttendanceModule,
    DailyOpsModule,
    HomeworkModule,
    ExaminationsModule,
    FeesFinanceModule,
    TransportModule,
    LibraryModule,
    CommunicationModule,
    StaffHrModule,
    InventoryModule,
    EventsModule,
    HealthIncidentsModule,
    CertificatesModule,
    PromotionModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
