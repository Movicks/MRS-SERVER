import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventStoreService } from '../../events/event-store.service';
import { InvoicesService } from '../invoices.service';
import {
  CreateInvoiceCommand,
  CancelInvoiceCommand,
  MarkInvoiceCopayPaidCommand,
  StampInvoiceNHIACommand,
  UpdateInvoiceItemsCommand,
  UpdateInvoicePaymentStatusCommand
} from './invoices.commands';

@CommandHandler(CreateInvoiceCommand)
export class CreateInvoiceHandler implements ICommandHandler<CreateInvoiceCommand> {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: CreateInvoiceCommand) {
    const createdByUserId = command.meta?.userId;
    const roles = command.meta?.roles || [];
    const res: any = await this.invoicesService.create(
      command.payload.patientId,
      { drugs: command.payload.drugs, items: command.payload.items },
      { createdByUserId, roles }
    );
    const id = String(res?._id || res?.id || '');
    await this.eventStore.append({
      aggregateType: 'Invoice',
      aggregateId: id || String(command.payload.patientId),
      eventType: 'InvoiceCreated',
      payload: {
        invoice: res
      },
      meta: {
        actorUserId: command.meta?.userId,
        actorRoles: command.meta?.roles
      }
    });
    return res;
  }
}

@CommandHandler(UpdateInvoicePaymentStatusCommand)
export class UpdateInvoicePaymentStatusHandler implements ICommandHandler<UpdateInvoicePaymentStatusCommand> {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: UpdateInvoicePaymentStatusCommand) {
    const res: any = await this.invoicesService.updatePaymentStatus(command.id, command.paymentStatus, {
      userId: command.meta?.userId,
      roles: command.meta?.roles
    });
    await this.eventStore.append({
      aggregateType: 'Invoice',
      aggregateId: String(command.id),
      eventType: 'InvoicePaymentStatusUpdated',
      payload: {
        invoice: res
      },
      meta: {
        actorUserId: command.meta?.userId,
        actorRoles: command.meta?.roles
      }
    });
    return res;
  }
}

@CommandHandler(StampInvoiceNHIACommand)
export class StampInvoiceNHIAHandler implements ICommandHandler<StampInvoiceNHIACommand> {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: StampInvoiceNHIACommand) {
    const res: any = await this.invoicesService.stampNHIA(command.id, { userId: command.meta?.userId, roles: command.meta?.roles });
    await this.eventStore.append({
      aggregateType: 'Invoice',
      aggregateId: String(command.id),
      eventType: 'InvoiceNHIAStamped',
      payload: { invoice: res },
      meta: {
        actorUserId: command.meta?.userId,
        actorRoles: command.meta?.roles
      }
    });
    return res;
  }
}

@CommandHandler(MarkInvoiceCopayPaidCommand)
export class MarkInvoiceCopayPaidHandler implements ICommandHandler<MarkInvoiceCopayPaidCommand> {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: MarkInvoiceCopayPaidCommand) {
    const res: any = await this.invoicesService.markCopayPaid(command.id, { userId: command.meta?.userId, roles: command.meta?.roles });
    await this.eventStore.append({
      aggregateType: 'Invoice',
      aggregateId: String(command.id),
      eventType: 'InvoiceNHIACopayPaid',
      payload: { invoice: res },
      meta: {
        actorUserId: command.meta?.userId,
        actorRoles: command.meta?.roles
      }
    });
    return res;
  }
}

@CommandHandler(UpdateInvoiceItemsCommand)
export class UpdateInvoiceItemsHandler implements ICommandHandler<UpdateInvoiceItemsCommand> {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: UpdateInvoiceItemsCommand) {
    const res: any = await this.invoicesService.updateItems(command.id, command.items, {
      userId: command.meta?.userId,
      roles: command.meta?.roles
    });
    await this.eventStore.append({
      aggregateType: 'Invoice',
      aggregateId: String(command.id),
      eventType: 'InvoiceItemsUpdated',
      payload: { invoice: res },
      meta: {
        actorUserId: command.meta?.userId,
        actorRoles: command.meta?.roles
      }
    });
    return res;
  }
}

@CommandHandler(CancelInvoiceCommand)
export class CancelInvoiceHandler implements ICommandHandler<CancelInvoiceCommand> {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: CancelInvoiceCommand) {
    const res: any = await this.invoicesService.cancelInvoice(command.id, {
      userId: command.meta?.userId,
      roles: command.meta?.roles
    });
    await this.eventStore.append({
      aggregateType: 'Invoice',
      aggregateId: String(command.id),
      eventType: 'InvoiceCanceled',
      payload: { invoice: res },
      meta: {
        actorUserId: command.meta?.userId,
        actorRoles: command.meta?.roles
      }
    });
    return res;
  }
}

export const InvoiceCommandHandlers = [
  CreateInvoiceHandler,
  UpdateInvoicePaymentStatusHandler,
  StampInvoiceNHIAHandler,
  MarkInvoiceCopayPaidHandler,
  UpdateInvoiceItemsHandler,
  CancelInvoiceHandler
];
