import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TripType } from '@prisma/client';

export class StartTripDto {
  @IsString()
  @IsNotEmpty()
  routeId: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  vehicleId?: string;

  @IsEnum(TripType)
  tripType: TripType;
}