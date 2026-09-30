export type XrayReferralDocument = XrayReferral;

export enum XrayReferralStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  COMPLETED = 'COMPLETED',
}

export class XrayReferral {
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
  imagingArea?: string;
  examinationRequired?: string;
  diagnosis?: string;
  statement?: string;
  previousReportNos?: string;
  previousReportDate?: Date;
  testResults?: Record<string, string>;
  status: XrayReferralStatus;
  createdAt?: Date;
  updatedAt?: Date;
}
