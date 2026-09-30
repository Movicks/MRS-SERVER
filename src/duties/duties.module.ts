import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DutiesService } from './duties.service';
import { DutiesController } from './duties.controller';
import { UsersModule } from '../users/users.module';
import { DepartmentsModule } from '../departments/departments.module';
import { EventsModule } from '../events/events.module';
import { DutiesReplayService } from './projection/duties-replay.service';
import { DutyCommandHandlers } from './cqrs/duties.handlers';

@Module({
  imports: [CqrsModule, UsersModule, DepartmentsModule, EventsModule],
  controllers: [DutiesController],
  providers: [DutiesService, DutiesReplayService, ...DutyCommandHandlers],
  exports: [DutiesService, DutiesReplayService],
})
export class DutiesModule {}
