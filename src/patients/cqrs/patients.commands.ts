export type ActorMeta = {
  userId?: string;
  roles?: string[];
};

export class CreatePatientCommand {
  constructor(public readonly payload: any, public readonly meta?: ActorMeta) {}
}

export class UpdatePatientCommand {
  constructor(public readonly id: string, public readonly payload: any, public readonly meta?: ActorMeta) {}
}

export class DeletePatientCommand {
  constructor(public readonly id: string, public readonly meta?: ActorMeta) {}
}

export class AddPatientToPharmacyCommand {
  constructor(
    public readonly patientId: string,
    public readonly payload: { prescription?: string; drugs?: any[] },
    public readonly meta?: ActorMeta
  ) {}
}

export class UpdatePharmacyDeskStateCommand {
  constructor(
    public readonly patientId: string,
    public readonly payload: { deskState: string; prescription?: string; drugs?: any[] },
    public readonly meta?: ActorMeta
  ) {}
}

