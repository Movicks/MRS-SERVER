import type { BillingRoute, PaymentStatus } from '../invoice.schema';

export type ActorMeta = {
  userId?: string;
  roles?: string[];
};

export class CreateInvoiceCommand {
  constructor(
    public readonly payload: { patientId: string; drugs?: any[]; items?: any[]; preferredBillingRoute?: BillingRoute },
    public readonly meta?: ActorMeta
  ) {}
}

export class UpdateInvoicePaymentStatusCommand {
  constructor(
    public readonly id: string,
    public readonly paymentStatus: PaymentStatus,
    public readonly meta?: ActorMeta
  ) {}
}

export class StampInvoiceNHIACommand {
  constructor(
    public readonly id: string,
    public readonly meta?: ActorMeta
  ) {}
}

export class MarkInvoiceCopayPaidCommand {
  constructor(
    public readonly id: string,
    public readonly meta?: ActorMeta
  ) {}
}

export class UpdateInvoiceItemsCommand {
  constructor(
    public readonly id: string,
    public readonly items: any[],
    public readonly meta?: ActorMeta
  ) {}
}

export class CancelInvoiceCommand {
  constructor(
    public readonly id: string,
    public readonly meta?: ActorMeta
  ) {}
}
