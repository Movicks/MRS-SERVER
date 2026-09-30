import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventStoreService } from '../../events/event-store.service';

@Injectable()
export class InvoicesReplayService {
  constructor(
    private readonly events: EventStoreService,
    private readonly prisma: PrismaService
  ) {}

  async rebuildFromEvents() {
    await this.prisma.invoice.deleteMany({});
    const stream = await this.events.scan({ aggregateType: 'Invoice' });
    for (const e of stream as any[]) {
      const invoice = (e.payload || {}).invoice;
      if (!invoice?.id && !invoice?._id) continue;
      const id = String(invoice.id || invoice._id);
      const { _id, ...invoiceData } = invoice;
      if ([
        'InvoiceCreated',
        'InvoicePaymentStatusUpdated',
        'InvoiceNHIAStamped',
        'InvoiceNHIACopayPaid',
        'InvoiceItemsUpdated',
        'InvoiceCanceled'
      ].includes(e.eventType)) {
        await this.prisma.invoice.upsert({
          where: { id },
          create: { id, ...invoiceData },
          update: invoiceData
        });
      }
    }
    return { ok: true };
  }
}
