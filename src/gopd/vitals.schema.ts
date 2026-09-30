export type VitalSignDocument = VitalSign;

export class VitalSign {
  id?: string;
  patientId: string;
  recordedBy?: string;
  recordedAt: Date;
  temperature?: number;
  pulse?: number;
  respirationRate?: number;
  bp?: string;
  spo2?: number;
  fbsRbs?: string;
  height?: number;
  weight?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
