export type DutyRecordDocument = DutyRecord;

export enum Shift {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  NIGHT = 'NIGHT',
}

export enum DutyStatus {
  ON_DUTY = 'ON_DUTY',
  COMPLETED = 'COMPLETED',
  ABSENT = 'ABSENT',
  SWAPPED = 'SWAPPED',
}

export class DutyRecord {
  id?: string;
  doctorUserId?: string;
  nurseUserId?: string;
  recordingUserId?: string;
  radiologyUserId?: string;
  departmentId: string;
  date: Date;
  shift: Shift;
  timeIn: Date;
  timeOut: Date;
  status: DutyStatus;
  assignedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}
