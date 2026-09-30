export enum PaymentStatus {
  AWAITING = 'awaiting',
  PAID = 'paid',
  CANCELED = 'canceled',
}

export enum BillingRoute {
  PAYPOINT = 'paypoint',
  NHIA = 'nhia',
}

export enum NHIAStampStatus {
  AWAITING = 'awaiting',
  STAMPED = 'stamped',
}

export enum CopayStatus {
  AWAITING = 'awaiting',
  PAID = 'paid',
}

export type InvoiceDocument = Invoice;

class InvoiceDrugItem {
  priceItemId?: string;
  category?: string;
  unit?: string;
  name: string;
  dosage: string;
  quantity: number;
  instructions?: string;
  unitPrice: number;
  totalPrice: number;
}

class InvoiceItem {
  priceItemId?: string;
  category?: string;
  unit?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export class Invoice {
  id?: string;
  patientId: string;
  createdByUserId?: string;
  createdByRole?: string;
  paidByUserId?: string;
  paidByRole?: string;
  paidAt?: Date;
  patientName: string;
  patientCardNumber: string;
  drugs: InvoiceDrugItem[];
  items: InvoiceItem[];
  totalCost: number;
  billingRoute: BillingRoute;
  patientIsPersonnel?: boolean;
  patientHasNHIAAccess?: boolean;
  patientCopayPercent: number;
  patientCopayAmount: number;
  patientAmountDue: number;
  nhiaAmountDue: number;
  copayStatus: CopayStatus;
  copayPaidAt?: Date;
  copayPaidByRole?: string;
  copayPaidByUserId?: string;
  nhiaStampStatus: NHIAStampStatus;
  nhiaStampedAt?: Date;
  nhiaStampedByRole?: string;
  nhiaStampedByUserId?: string;
  paymentStatus: PaymentStatus;
  createdAt?: Date;
  updatedAt?: Date;
}
