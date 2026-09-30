export type PriceItemDocument = PriceItem;

export enum PriceCategory {
  DRUG = 'drug',
  CONSULTATION = 'consultation',
  BED = 'bed',
  TEST = 'test',
  SCAN = 'scan',
  PROCEDURE = 'procedure',
  LABORATORY = 'laboratory',
  OTHER = 'other',
}

export class PriceItem {
  id?: string;
  name: string;
  category: string;
  description?: string;
  unit?: string;
  price: number;
  isActive?: boolean;
  sortOrder?: number;
  stockQuantity?: number;
  soldQuantity?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
