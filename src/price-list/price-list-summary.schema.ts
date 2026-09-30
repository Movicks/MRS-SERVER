export type PriceListSummaryDocument = PriceListSummary;

export enum SummaryPeriod {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class PriceListSummary {
  id?: string;
  period: SummaryPeriod;
  referenceDate: string;
  totalItems?: number;
  activeItems?: number;
  drugs?: number;
  totalDrugs?: number;
  services?: number;
  servicesValue?: number;
  totalValue?: number;
  totalDrugsInStock?: number;
  totalDrugsSold?: number;
  totalDrugsSoldValue?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
