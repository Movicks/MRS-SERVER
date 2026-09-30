export type LabReferralDocument = LabReferral;

export enum LabReferralStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  COMPLETED = 'COMPLETED',
}

export class LabReferral {
  id?: string;
  patientId: string;
  senderId: string;
  invoiceId?: string;
  date: Date;
  serviceNoOrUUID?: string;
  rank?: string;
  forenames?: string;
  surname?: string;
  wardNo?: string;
  hospitalUnit?: string;
  age?: string;
  to?: string;
  specimen?: string;
  examinationRequired?: string;
  diagnosis?: string;
  statement?: string;
  previousReportNos?: string;
  previousReportDate?: Date;
  testResults?: Record<string, string>;
  status: LabReferralStatus;
  createdAt?: Date;
  updatedAt?: Date;
}
