import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PriceListService } from '../price-list/price-list.service';

export enum WardAdmissionStatus {
  ADMITTED = 'admitted',
  DISCHARGED = 'discharged',
}

export type WardMedicationOrder = {
  priceItemId: string;
  name: string;
  quantity: number;
  instructions: string;
  usage: string;
};

export type WardMedicationAdministration = {
  drugPriceItemId: string;
  scheduledAt: Date;
  administeredAt: Date;
  administeredByUserId?: string;
  administeredByRole?: string;
};

@Injectable()
export class WardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceList: PriceListService,
    private readonly rt: RealtimeGateway,
  ) {}

  private readonly WARD_UNITS = ['ChildrenWard', 'FemaleWard', 'MaleWard', 'MaleVIP', 'FemaleVIP'] as const;

  private pickRole(rolesRaw: string[] | undefined, priority: string[]) {
    const roles = (rolesRaw || []).map((r) => {
      const v = String(r || '').trim().toLowerCase();
      return v === 'nurse' ? 'staff' : v;
    });
    return priority.find((r) => roles.includes(r)) || (roles[0] || '');
  }

  private normalizeWardUnit(value: string) {
    const v = String(value || '').trim();
    const match = this.WARD_UNITS.find((x) => x.toLowerCase() === v.toLowerCase());
    if (!match) throw new BadRequestException('Invalid ward unit');
    return match;
  }

  private validatePatientForWard(patient: any, wardUnit: string) {
    const sex = String(patient?.sex || '').trim().toLowerCase();
    const age = Number(patient?.age ?? 0) || 0;
    if (wardUnit === 'ChildrenWard' && age >= 16) {
      throw new BadRequestException('Children ward is only for patients below age 16');
    }
    if (wardUnit === 'MaleWard' || wardUnit === 'MaleVIP') {
      if (sex && sex !== 'male') throw new BadRequestException('Ward requires male patient');
    }
    if (wardUnit === 'FemaleWard' || wardUnit === 'FemaleVIP') {
      if (sex && sex !== 'female') throw new BadRequestException('Ward requires female patient');
    }
  }

  async list(opts?: { wardUnit?: string; status?: WardAdmissionStatus | 'all' }) {
    const q: any = {};
    if (opts?.wardUnit) q.wardUnit = this.normalizeWardUnit(opts.wardUnit);
    if (opts?.status && opts.status !== 'all') q.status = opts.status;

    const docs = await this.prisma.wardAdmission.findMany({
      where: q,
      orderBy: { admittedAt: 'desc' }
    });

    const patientIds = Array.from(new Set(docs.map((d) => d.patientId).filter(Boolean)));
    const patients = await this.prisma.patient.findMany({
      where: { id: { in: patientIds } }
    });
    const patientMap = new Map<string, any>();
    for (const p of patients) patientMap.set(p.id, p);

    return docs.map((d) => {
      const p = patientMap.get(d.patientId) || {};
      return {
        _id: d.id,
        id: d.id,
        patientId: d.patientId,
        fullName: [p.surname, p.firstname, p.middlename].filter(Boolean).join(' '),
        cardNumber: p.veteran ? (p.serviceNumber || '') : (p.membershipNumber || ''),
        phone: p.phone || '',
        rank: p.rank || '',
        sex: p.sex || '',
        age: p.age ?? null,
        wardUnit: d.wardUnit,
        bedPriceItemId: d.bedPriceItemId || '',
        quantity: d.quantity || 1,
        admittedAt: d.admittedAt,
        status: d.status,
        dischargedAt: d.dischargedAt || null,
        pharmacyPrescription: d.pharmacyPrescription || '',
        medicationOrders: Array.isArray(d.medicationOrders as any) ? d.medicationOrders : [],
        medicationAdministrations: Array.isArray(d.medicationAdministrations as any) ? d.medicationAdministrations : [],
      };
    });
  }

  async admit(
    payload: {
      patientId: string;
      wardUnit: string;
      bedPriceItemId: string;
      quantity?: number;
      pharmacyPrescription?: string;
      medicationOrders?: WardMedicationOrder[];
    },
    meta?: { userId?: string; roles?: string[] }
  ) {
    const pid = payload.patientId;
    const patient = await this.prisma.patient.findUnique({ where: { id: pid } });
    if (!patient) throw new NotFoundException('Patient not found');

    const wardUnit = this.normalizeWardUnit(payload.wardUnit);
    this.validatePatientForWard(patient, wardUnit);

    const quantity = Number(payload.quantity ?? 1);
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    const existing = await this.prisma.wardAdmission.findFirst({
      where: { patientId: pid, status: WardAdmissionStatus.ADMITTED }
    });
    if (existing) throw new BadRequestException('Patient is already admitted');

    const bedPriceItemId = String(payload.bedPriceItemId || '').trim();
    if (!bedPriceItemId) throw new BadRequestException('Bed price item id is required');

    const pharmacyPrescription = String(payload.pharmacyPrescription || '').trim();
    const medicationOrders = (Array.isArray(payload.medicationOrders) ? payload.medicationOrders : [])
      .map((o: any) => ({
        priceItemId: String(o?.priceItemId || '').trim(),
        name: String(o?.name || '').trim(),
        quantity: Number(o?.quantity ?? 0) || 0,
        instructions: String(o?.instructions || '').trim(),
        usage: String(o?.usage || '').trim(),
      }))
      .filter((o) => !!o.priceItemId && !!o.name);

    await this.priceList.occupyBed(bedPriceItemId, quantity);

    const admittedByRole = this.pickRole(meta?.roles, ['pharmacy', 'recording', 'admin', 'super_admin']);
    const saved = await this.prisma.wardAdmission.create({
      data: {
        patientId: pid,
        wardUnit,
        bedPriceItemId,
        quantity,
        admittedAt: new Date(),
        admittedByUserId: meta?.userId,
        admittedByRole,
        status: WardAdmissionStatus.ADMITTED,
        pharmacyPrescription,
        medicationOrders: medicationOrders as any,
        medicationAdministrations: [] as any,
      }
    });
    this.rt.emit('wardAdmission.created', { id: saved.id, patientId: payload.patientId, wardUnit });
    return saved;
  }

  async discharge(id: string, meta?: { userId?: string; roles?: string[] }) {
    const doc = await this.prisma.wardAdmission.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Ward admission not found');
    if (doc.status === WardAdmissionStatus.DISCHARGED) return doc;

    const bedPriceItemId = String(doc.bedPriceItemId || '').trim();
    const qty = Number(doc.quantity || 1);
    if (bedPriceItemId) {
      await this.priceList.releaseBed(bedPriceItemId, qty);
    }

    const dischargedByRole = this.pickRole(meta?.roles, ['ward', 'pharmacy', 'admin', 'super_admin']);
    const saved = await this.prisma.wardAdmission.update({
      where: { id },
      data: {
        status: WardAdmissionStatus.DISCHARGED,
        dischargedAt: new Date(),
        dischargedByRole,
        dischargedByUserId: meta?.userId
      }
    });
    this.rt.emit('wardAdmission.updated', { id: saved.id, patientId: saved.patientId, wardUnit: saved.wardUnit, status: saved.status });
    return saved;
  }

  async administerMedication(
    admissionId: string,
    payload: { drugPriceItemId: string; scheduledAt: string | Date },
    meta?: { userId?: string; roles?: string[] }
  ) {
    const doc = await this.prisma.wardAdmission.findUnique({ where: { id: admissionId } });
    if (!doc) throw new NotFoundException('Ward admission not found');
    if (doc.status !== WardAdmissionStatus.ADMITTED) throw new BadRequestException('Patient is not currently admitted');

    const drugPriceItemId = String(payload.drugPriceItemId || '').trim();
    if (!drugPriceItemId) throw new BadRequestException('drugPriceItemId is required');

    const scheduledAt = new Date(payload.scheduledAt as any);
    if (!Number.isFinite(scheduledAt.getTime())) throw new BadRequestException('Invalid scheduledAt');

    const currentAdmins = Array.isArray(doc.medicationAdministrations as any) ? (doc.medicationAdministrations as any[]) : [];
    const scheduledAtMs = scheduledAt.getTime();
    const existing = currentAdmins.find(
      (x: any) => String(x?.drugPriceItemId || '') === drugPriceItemId && new Date(x?.scheduledAt as any).getTime() === scheduledAtMs
    );
    if (existing) return doc;

    const administeredByRole = this.pickRole(meta?.roles, ['staff', 'pharmacy', 'admin', 'super_admin']);
    const updatedAdmins = [
      ...currentAdmins,
      {
        drugPriceItemId,
        scheduledAt,
        administeredAt: new Date(),
        administeredByUserId: meta?.userId,
        administeredByRole,
      },
    ];

    const saved = await this.prisma.wardAdmission.update({
      where: { id: admissionId },
      data: { medicationAdministrations: updatedAdmins as any }
    });

    this.rt.emit('wardAdmission.updated', { id: saved.id, patientId: saved.patientId, wardUnit: saved.wardUnit });
    return saved;
  }

  async updateMedicationOrders(
    admissionId: string,
    payload: { pharmacyPrescription?: string; medicationOrders?: WardMedicationOrder[] },
    meta?: { userId?: string; roles?: string[] }
  ) {
    const doc = await this.prisma.wardAdmission.findUnique({ where: { id: admissionId } });
    if (!doc) throw new NotFoundException('Ward admission not found');
    if (doc.status !== WardAdmissionStatus.ADMITTED) throw new BadRequestException('Patient is not currently admitted');

    const pharmacyPrescription = payload.pharmacyPrescription !== undefined
      ? String(payload.pharmacyPrescription || '').trim()
      : String(doc.pharmacyPrescription || '').trim();

    const medicationOrders = (Array.isArray(payload.medicationOrders) ? payload.medicationOrders : [])
      .map((o: any) => ({
        priceItemId: String(o?.priceItemId || '').trim(),
        name: String(o?.name || '').trim(),
        quantity: Number(o?.quantity ?? 0) || 0,
        instructions: String(o?.instructions || '').trim(),
        usage: String(o?.usage || '').trim(),
      }))
      .filter((o) => !!o.priceItemId && !!o.name && Number(o.quantity) > 0);

    const saved = await this.prisma.wardAdmission.update({
      where: { id: admissionId },
      data: {
        pharmacyPrescription,
        medicationOrders: medicationOrders as any
      }
    });

    const role = this.pickRole(meta?.roles, ['staff', 'pharmacy', 'doctor', 'recording', 'admin', 'super_admin']);
    this.rt.emit('wardAdmission.updated', { id: saved.id, patientId: saved.patientId, wardUnit: saved.wardUnit, updatedByRole: role });
    return saved;
  }
}
