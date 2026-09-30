import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PriceCategory } from '../price-item.schema';

export class CreatePriceItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, default: 'per item' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false, default: 0 })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stockQuantity?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  soldQuantity?: number;
}
