export type DoctorReportDocument = DoctorReport;

export class DoctorReport {
  id?: string;
  patientId: string;
  senderId: string;
  senderName?: string;
  text?: string;
  clinicalNote?: string;
  diagnosis?: string;
  imageUrl?: string;
  replyToId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
