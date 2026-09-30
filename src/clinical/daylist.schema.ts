export type ClinicalDayListDocument = ClinicalDayList;

export class ClinicalDayList {
  id?: string;
  patientId: string;
  addedBy?: string;
  sourceDepartment?: string;
  targetDepartment: string;
  createdAt?: Date;
  updatedAt?: Date;
}

