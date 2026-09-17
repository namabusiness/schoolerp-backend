import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { LibraryService } from './library.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { LoanStatus } from '@prisma/client';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private libraryService: LibraryService) {}

  @Get('catalogue')
  async getCatalogue(@Tenant() schoolId: string, @Query('search') search?: string) {
    return this.libraryService.getCatalogue(schoolId, search);
  }

  @Post('catalogue')
  async addBook(@Tenant() schoolId: string, @Body() body: any) {
    return this.libraryService.addBook(schoolId, body);
  }

  @Get('loans')
  async getLoans(@Tenant() schoolId: string, @Query('status') status?: LoanStatus) {
    return this.libraryService.getLoans(schoolId, status);
  }

  @Post('issue')
  async issueBook(@Tenant() schoolId: string, @Body() body: any) {
    return this.libraryService.issueBook(schoolId, body);
  }

  @Post('loans/:id/return')
  async returnBook(@Tenant() schoolId: string, @Param('id') loanId: string) {
    return this.libraryService.returnBook(schoolId, loanId);
  }
}
