import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventStoreService } from '../../events/event-store.service';
import { GopdQueueService } from '../../gopd/gopd-queue.service';

@Injectable()
export class PatientsReplayService {
  constructor(
    private readonly events: EventStoreService,
    private readonly prisma: PrismaService,
    private readonly gopdQueue: GopdQueueService
  ) {}

  async rebuildFromEvents() {
    await this.prisma.patient.deleteMany({});
    await this.prisma.pharmacyPatient.deleteMany({});
    const existing = await this.gopdQueue.list();
    await Promise.all(existing.map((e) => this.gopdQueue.remove(String((e as any).patientId))));

    const stream = await this.events.scan();
    for (const ev of stream as any[]) {
      if (ev.aggregateType === 'Patient') {
        if (ev.eventType === 'PatientCreated' || ev.eventType === 'PatientUpdated') {
          const patient = (ev.payload || {}).patient;
          if (!patient?.id && !patient?._id) continue;
          const pid = String(patient.id || patient._id);
          const { _id, ...dataWithoutId } = patient;
          await this.prisma.patient.upsert({
            where: { id: pid },
            create: { id: pid, ...dataWithoutId },
            update: dataWithoutId
          });
          if (patient.patientQueue === 'godp_vitals') {
            await this.gopdQueue.ensureFromPatient({ ...patient, id: pid } as any);
          } else {
            await this.gopdQueue.remove(pid);
          }
        } else if (ev.eventType === 'PatientDeleted') {
          const id = String((ev.payload || {}).patientId || ev.aggregateId || '');
          if (!id) continue;
          await this.prisma.patient.delete({ where: { id } }).catch(() => null);
          await this.prisma.pharmacyPatient.deleteMany({ where: { patientId: id } });
          await this.gopdQueue.remove(id);
        }
      } else if (ev.aggregateType === 'PharmacyPatient') {
        if (ev.eventType === 'PatientAddedToPharmacy' || ev.eventType === 'PharmacyDeskStateUpdated') {
          const pp = (ev.payload || {}).pharmacyPatient;
          if (!pp?.patientId) continue;
          const pid = String(pp.patientId);
          const { _id, patientId, ...dataWithoutId } = pp;
          await this.prisma.pharmacyPatient.upsert({
            where: { patientId: pid },
            create: { patientId: pid, ...dataWithoutId },
            update: dataWithoutId
          });
        }
      }
    }
    return { ok: true };
  }
}
