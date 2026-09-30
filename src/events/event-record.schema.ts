export type EventRecordDocument = EventRecord;

export class EventRecord {
  id?: string;
  seq: number;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  version?: number;
  occurredAt: Date;
  payload: Record<string, unknown>;
  meta?: Record<string, unknown>;
  createdAt?: Date;
}
