import type { Shift, DutyStatus } from '../duty.schema';

export type ActorMeta = {
  userId?: string;
  roles?: string[];
};

export class CreateDutyCommand {
  constructor(
    public readonly payload: {
      role: 'doctor' | 'staff' | 'recording' | 'radiology';
      staffId?: string;
      staffIds?: string[];
      departmentId: string;
      date: string;
      shift: Shift;
      timeIn: string;
      timeOut: string;
      status: DutyStatus;
      assignedBy: string;
    },
    public readonly meta?: ActorMeta
  ) {}
}

export class UpdateDutyCommand {
  constructor(
    public readonly id: string,
    public readonly payload: Partial<{
      departmentId: string;
      date: string;
      shift: Shift;
      timeIn: string;
      timeOut: string;
      status: DutyStatus;
    }>,
    public readonly meta?: ActorMeta
  ) {}
}

export class DeleteDutyCommand {
  constructor(public readonly id: string, public readonly meta?: ActorMeta) {}
}

