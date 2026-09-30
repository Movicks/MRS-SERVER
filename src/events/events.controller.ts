import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { EventStoreService } from './event-store.service';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(private readonly store: EventStoreService) {}

  @Roles('super_admin' as Role, 'admin' as Role)
  @Get()
  async list(
    @Query('aggregateType') aggregateType?: string,
    @Query('aggregateId') aggregateId?: string,
    @Query('eventType') eventType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string
  ) {
    return this.store.list({
      aggregateType,
      aggregateId,
      eventType,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      skip: skip ? Number(skip) : undefined
    });
  }
}

