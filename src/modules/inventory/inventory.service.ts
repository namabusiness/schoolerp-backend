import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getAssets(schoolId: string, category?: string) {
    const where: any = { schoolId };
    if (category) where.category = category;
    return this.prisma.assetItem.findMany({ where });
  }

  async addAsset(schoolId: string, data: any) {
    return this.prisma.assetItem.create({
      data: {
        schoolId,
        name: data.name,
        code: data.code.toUpperCase(),
        category: data.category || 'General',
        status: data.status || 'ACTIVE',
        allocatedTo: data.allocatedTo,
      },
    });
  }

  async getPurchaseRequests(schoolId: string) {
    return this.prisma.purchaseRequest.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPurchaseRequest(schoolId: string, data: any) {
    return this.prisma.purchaseRequest.create({
      data: {
        schoolId,
        itemTitle: data.itemTitle,
        requestedBy: data.requestedBy,
        quantity: Number(data.quantity) || 1,
        estimatedCost: Number(data.estimatedCost) || 0,
        status: 'PENDING',
      },
    });
  }

  async updatePurchaseStatus(schoolId: string, id: string, status: string) {
    return this.prisma.purchaseRequest.update({
      where: { id, schoolId },
      data: { status },
    });
  }
}
