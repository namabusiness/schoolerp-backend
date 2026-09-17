import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('certificates')
@UseGuards(JwtAuthGuard)
export class CertificatesController {
  constructor(private certificatesService: CertificatesService) {}

  @Get()
  async getCertificates(@Tenant() schoolId: string, @Query('studentId') studentId?: string) {
    return this.certificatesService.getCertificates(schoolId, studentId);
  }

  @Post('issue')
  async issueCertificate(@Tenant() schoolId: string, @Body() body: any) {
    return this.certificatesService.issueCertificate(schoolId, body);
  }
}
