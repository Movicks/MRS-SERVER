import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DutiesService } from '../duties.service';
import { EventStoreService } from '../../events/event-store.service';
import { CreateDutyCommand, DeleteDutyCommand, UpdateDutyCommand } from './duties.commands';

@CommandHandler(CreateDutyCommand)
export class CreateDutyHandler implements ICommandHandler<CreateDutyCommand> {
  constructor(
    private readonly dutiesService: DutiesService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: CreateDutyCommand) {
    const res: any = await this.dutiesService.create(command.payload as any);
    const duties = Array.isArray(res?.duties) ? res.duties : [res];
    for (const duty of duties) {
      const id = String(duty?._id || duty?.id || '');
      if (!id) continue;
      await this.eventStore.append({
        aggregateType: 'Duty',
        aggregateId: id,
        eventType: 'DutyCreated',
        payload: {
          duty
        },
        meta: {
          actorUserId: command.meta?.userId,
          actorRoles: command.meta?.roles
        }
      });
    }
    return res;
  }
}

@CommandHandler(UpdateDutyCommand)
export class UpdateDutyHandler implements ICommandHandler<UpdateDutyCommand> {
  constructor(
    private readonly dutiesService: DutiesService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: UpdateDutyCommand) {
    const res: any = await this.dutiesService.update(command.id, command.payload as any);
    await this.eventStore.append({
      aggregateType: 'Duty',
      aggregateId: String(command.id),
      eventType: 'DutyUpdated',
      payload: {
        duty: res
      },
      meta: {
        actorUserId: command.meta?.userId,
        actorRoles: command.meta?.roles
      }
    });
    return res;
  }
}

@CommandHandler(DeleteDutyCommand)
export class DeleteDutyHandler implements ICommandHandler<DeleteDutyCommand> {
  constructor(
    private readonly dutiesService: DutiesService,
    private readonly eventStore: EventStoreService
  ) {}

  async execute(command: DeleteDutyCommand) {
    const res: any = await this.dutiesService.remove(command.id);
    await this.eventStore.append({
      aggregateType: 'Duty',
      aggregateId: String(command.id),
      eventType: 'DutyDeleted',
      payload: {
        dutyId: command.id
      },
      meta: {
        actorUserId: command.meta?.userId,
        actorRoles: command.meta?.roles
      }
    });
    return res;
  }
}

export const DutyCommandHandlers = [CreateDutyHandler, UpdateDutyHandler, DeleteDutyHandler];
