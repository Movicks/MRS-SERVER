import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { PriceListService, type SummaryPeriod } from './price-list.service';
import { CreatePriceItemDto } from './dto/create-price-item.dto';
import { UpdatePriceItemDto } from './dto/update-price-item.dto';

@ApiTags('Price List')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'price-list', version: '1' })
export class PriceListController {
  private readonly logger = new Logger(PriceListController.name);

  constructor(private readonly priceListService: PriceListService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.priceListService.list({
      q,
      category,
      activeOnly: activeOnly === 'true',
    });
  }

  @Get('summary')
  async summary(
    @Query('period') period?: SummaryPeriod,
    @Query('monthlyDate') monthlyDate?: string,
    @Query('yearlyDate') yearlyDate?: string,
    @Query('referenceDate') referenceDate?: string,
  ) {
    console.log('[PriceListController] summary called with params:', { period, monthlyDate, yearlyDate, referenceDate });
    try {
      const result = period 
        ? await this.priceListService.getSummary(period, referenceDate) 
        : await this.priceListService.getSummaries({ monthly: monthlyDate, yearly: yearlyDate });
      console.log('[PriceListController] summary returning:', result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown summary controller error';
      this.logger.error(`Summary endpoint failed: ${message}`, error);
      const fallback = {
        period: 'monthly' as const,
        from: '',
        to: '',
        totalItems: 0,
        activeItems: 0,
        drugs: 0,
        totalDrugs: 0,
        services: 0,
        servicesValue: 0,
        totalValue: 0,
        totalDrugsInStock: 0,
        totalDrugsSold: 0,
        totalDrugsSoldValue: 0,
        nhiaClearedValue: 0,
      };

      if (period) return { ...fallback, period };
      return {
        monthly: { ...fallback, period: 'monthly' as const },
        yearly: { ...fallback, period: 'yearly' as const },
      };
    }
  }

  @Post('summary')
  @Roles('super_admin', 'admin')
  async saveSummary(@Body() summaryData: any) {
    console.log('[PriceListController] saveSummary called with data:', summaryData);
    try {
      return await this.priceListService.saveSummary(summaryData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save summary';
      this.logger.error(`saveSummary endpoint failed: ${message}`, error);
      throw new BadRequestException(message);
    }
  }

  @Get('top-selling/drugs')
  @Roles('super_admin', 'admin')
  async topSellingDrugs(@Query('limit') limit?: string, @Query('activeOnly') activeOnly?: string) {
    return this.priceListService.getTopSellingDrugs({
      limit: limit ? Number(limit) : undefined,
      activeOnly: activeOnly === 'true',
    });
  }

  @Post('clone-month')
  @Roles('super_admin', 'admin')
  async cloneMonth(
    @Body()
    body: {
      fromMonth: string;
      toMonth: string;
      overwrite?: boolean;
      resetSoldQuantity?: boolean;
      resetStockQuantity?: boolean;
    },
  ) {
    try {
      return await this.priceListService.cloneMonth(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clone month';
      this.logger.error(`cloneMonth endpoint failed: ${message}`, error);
      throw new BadRequestException(message);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.priceListService.findOne(id);
  }

  @Post()
  @Roles('super_admin', 'admin')
  async create(@Body() dto: CreatePriceItemDto) {
    return this.priceListService.create(dto);
  }

  @Patch(':id')
  @Roles('super_admin', 'admin')
  async update(@Param('id') id: string, @Body() dto: UpdatePriceItemDto) {
    return this.priceListService.update(id, dto);
  }

  @Patch(':id/dispense')
  @Roles('super_admin' as Role, 'admin' as Role, 'pharmacy' as Role, 'staff' as Role)
  async recordDispense(@Param('id') id: string, @Body() body: { quantity: number }) {
    return this.priceListService.recordDispense(id, body.quantity);
  }

  @Patch(':id/bed/occupy')
  @Roles('super_admin' as Role, 'admin' as Role, 'recording' as Role, 'doctor' as Role)
  async occupyBed(@Param('id') id: string, @Body() body: { quantity: number }) {
    return this.priceListService.occupyBed(id, body.quantity);
  }

  @Patch(':id/bed/release')
  @Roles('super_admin' as Role, 'admin' as Role, 'recording' as Role, 'doctor' as Role)
  async releaseBed(@Param('id') id: string, @Body() body: { quantity: number }) {
    return this.priceListService.releaseBed(id, body.quantity);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  async remove(@Param('id') id: string) {
    return this.priceListService.remove(id);
  }
}
