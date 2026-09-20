import { Type } from 'class-transformer';
import { IsDate, IsNumber, Max, Min, IsOptional } from 'class-validator';

export class LocationUpdateDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  speed?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @Type(() => Date)
  @IsDate()
  timestamp: Date;
}