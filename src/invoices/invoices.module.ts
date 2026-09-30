import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { EventsModule } from '../events/events.module';
import { InvoicesReplayService } from './projection/invoices-replay.service';
import { InvoiceCommandHandlers } from './cqrs/invoices.handlers';

@Module({
  imports: [CqrsModule, RealtimeModule, EventsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesReplayService, ...InvoiceCommandHandlers],
  exports: [InvoicesService, InvoicesReplayService],
})
export class InvoicesModule {}
