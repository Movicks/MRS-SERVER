export type DoctorDayListDocument = DoctorDayList;

export class DoctorDayList {
  id?: string;
  patientId: string;
  addedBy?: string;
  sourceDepartment?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
