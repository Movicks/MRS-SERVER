export type PharmacyPatientDocument = PharmacyPatient;

class DrugItem {
  name: string;
  dosage: string;
  quantity: number;
  instructions?: string;
  dispensed?: boolean;
  priceItemId?: string;
}

export class PharmacyPatient {
  id?: string;
  patientId: string;
  deskState: string;
  prescription?: string;
  drugs?: DrugItem[];
  createdAt?: Date;
  updatedAt?: Date;
}
