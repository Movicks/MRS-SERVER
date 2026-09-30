export type WardAdmissionDocument = WardAdmission;

export enum WardAdmissionStatus {
  ADMITTED = 'admitted',
  DISCHARGED = 'discharged',
}

export type WardMedicationOrder = {
  priceItemId: string;
  name: string;
  quantity: number;
  instructions: string;
  usage: string;
};

export type WardMedicationAdministration = {
  drugPriceItemId: string;
  scheduledAt: Date;
  administeredAt: Date;
  administeredByUserId?: string;
  administeredByRole?: string;
};

export class WardAdmission {
  id?: string;
  patientId: string;
  wardUnit: string;
  bedPriceItemId?: string;
  quantity: number;
  admittedAt: Date;
  admittedByUserId?: string;
  admittedByRole?: string;
  status: WardAdmissionStatus;
  dischargedAt?: Date;
  dischargedByUserId?: string;
  dischargedByRole?: string;
  pharmacyPrescription?: string;
  medicationOrders?: WardMedicationOrder[];
  medicationAdministrations?: WardMedicationAdministration[];
  createdAt?: Date;
  updatedAt?: Date;
}
