export type PatientDocument = Patient;

class NextOfKin {
  name: string;
  relationship: string;
  phone: string;
  address: string;
}

export class Patient {
  id?: string;
  surname: string;
  firstname: string;
  middlename?: string;
  veteran?: boolean;
  serviceNumber?: string;
  rank?: string;
  membershipNumber?: string;
  sex: string;
  age?: number;
  dateOfBirth?: string;
  country?: string;
  stateOfOrigin?: string;
  lga?: string;
  address?: string;
  religion?: string;
  maritalStatus?: string;
  phone?: string;
  occupation?: string;
  genotype?: string;
  bloodGroup?: string;
  patientStatus?: string;
  patientQueue?: string;
  nhiaStatus?: string;
  nhiaUpdatedAt?: Date;
  nok?: NextOfKin;
  createdAt?: Date;
  updatedAt?: Date;
}
