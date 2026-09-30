export type GopdQueueDocument = GopdQueue;

export class GopdQueue {
  id?: string;
  patientId: string;
  category?: string;
  cardNumber?: string;
  fullName?: string;
  phone?: string;
  rank?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
