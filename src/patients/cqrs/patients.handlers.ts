import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventStoreService } from '../../events/event-store.service';
import { PatientsService } from '../patients.service';
import {
  AddPatientToPharmacyCommand,
  CreatePatientCommand,
  DeletePatientCommand,
  UpdatePatientCommand,
  UpdatePharmacyDeskStateCommand
} from './patients.commands';

@CommandHandler(CreatePatientCommand)
export class CreatePatientHandler implements ICommandHandler<CreatePatientCommand> {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: CreatePatientCommand) {
    const doc: any = await this.patientsService.create(command.payload);
    const patient = doc?.toObject ? doc.toObject() : doc;
    const id = String(patient?._id || '');
    await this.eventStore.append({
      aggregateType: 'Patient',
      aggregateId: id,
      eventType: 'PatientCreated',
      payload: { patient },
      meta: { actorUserId: command.meta?.userId, actorRoles: command.meta?.roles }
    });
    return patient;
  }
}

@CommandHandler(UpdatePatientCommand)
export class UpdatePatientHandler implements ICommandHandler<UpdatePatientCommand> {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: UpdatePatientCommand) {
    const doc: any = await this.patientsService.update(command.id, command.payload);
    const patient = doc?.toObject ? doc.toObject() : doc;
    await this.eventStore.append({
      aggregateType: 'Patient',
      aggregateId: String(command.id),
      eventType: 'PatientUpdated',
      payload: { patient },
      meta: { actorUserId: command.meta?.userId, actorRoles: command.meta?.roles }
    });
    return patient;
  }
}

@CommandHandler(DeletePatientCommand)
export class DeletePatientHandler implements ICommandHandler<DeletePatientCommand> {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: DeletePatientCommand) {
    const before: any = await this.patientsService.findById(command.id);
    const patient = before?.toObject ? before.toObject() : (before || null);
    await this.patientsService.remove(command.id);
    await this.eventStore.append({
      aggregateType: 'Patient',
      aggregateId: String(command.id),
      eventType: 'PatientDeleted',
      payload: { patientId: command.id, patient },
      meta: { actorUserId: command.meta?.userId, actorRoles: command.meta?.roles }
    });
    return { ok: true };
  }
}

@CommandHandler(AddPatientToPharmacyCommand)
export class AddPatientToPharmacyHandler implements ICommandHandler<AddPatientToPharmacyCommand> {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: AddPatientToPharmacyCommand) {
    const doc: any = await this.patientsService.addToPharmacy(command.patientId, command.payload);
    const pharmacyPatient = doc?.toObject ? doc.toObject() : doc;
    await this.eventStore.append({
      aggregateType: 'PharmacyPatient',
      aggregateId: String(command.patientId),
      eventType: 'PatientAddedToPharmacy',
      payload: { pharmacyPatient },
      meta: { actorUserId: command.meta?.userId, actorRoles: command.meta?.roles }
    });
    return pharmacyPatient;
  }
}

@CommandHandler(UpdatePharmacyDeskStateCommand)
export class UpdatePharmacyDeskStateHandler implements ICommandHandler<UpdatePharmacyDeskStateCommand> {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: UpdatePharmacyDeskStateCommand) {
    const doc: any = await this.patientsService.updatePharmacyDeskState(command.patientId, command.payload.deskState, {
      prescription: command.payload.prescription,
      drugs: command.payload.drugs
    });
    const pharmacyPatient = doc?.toObject ? doc.toObject() : doc;
    await this.eventStore.append({
      aggregateType: 'PharmacyPatient',
      aggregateId: String(command.patientId),
      eventType: 'PharmacyDeskStateUpdated',
      payload: { pharmacyPatient },
      meta: { actorUserId: command.meta?.userId, actorRoles: command.meta?.roles }
    });
    return pharmacyPatient;
  }
}

export const PatientCommandHandlers = [
  CreatePatientHandler,
  UpdatePatientHandler,
  DeletePatientHandler,
  AddPatientToPharmacyHandler,
  UpdatePharmacyDeskStateHandler
];

