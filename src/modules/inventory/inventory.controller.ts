import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Tenant } from '../../common/decorators/tenant.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get('assets')
  async getAssets(@Tenant() schoolId: string, @Query('category') category?: string) {
    return this.inventoryService.getAssets(schoolId, category);
  }

  @Post('assets')
  async addAsset(@Tenant() schoolId: string, @Body() body: any) {
    return this.inventoryService.addAsset(schoolId, body);
  }

  @Get('requests')
  async getPurchaseRequests(@Tenant() schoolId: string) {
    return this.inventoryService.getPurchaseRequests(schoolId);
  }

  @Post('requests')
  async createPurchaseRequest(@Tenant() schoolId: string, @Body() body: any) {
    return this.inventoryService.createPurchaseRequest(schoolId, body);
  }

  @Patch('requests/:id/status')
  async updatePurchaseStatus(
    @Tenant() schoolId: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.inventoryService.updatePurchaseStatus(schoolId, id, status);
  }
}
