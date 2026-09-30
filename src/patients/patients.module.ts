import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { GopdModule } from '../gopd/gopd.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { EventsModule } from '../events/events.module';
import { PatientsReplayService } from './projection/patients-replay.service';
import { PatientCommandHandlers } from './cqrs/patients.handlers';

@Module({
  imports: [CqrsModule, GopdModule, RealtimeModule, InvoicesModule, EventsModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientsReplayService, ...PatientCommandHandlers],
  exports: [PatientsService, PatientsReplayService],
})
export class PatientsModule {}
