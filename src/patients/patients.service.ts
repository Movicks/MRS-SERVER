import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GopdQueueService } from '../gopd/gopd-queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gopdQueue: GopdQueueService,
    private readonly rt: RealtimeGateway,
    private readonly invoices: InvoicesService,
  ) {}

  async list(search?: string): Promise<any[]> {
    const s = search?.trim();
    if (!s) return this.prisma.patient.findMany();

    return this.prisma.patient.findMany({
      where: {
        OR: [
          { surname: { contains: s, mode: 'insensitive' } },
          { firstname: { contains: s, mode: 'insensitive' } },
          { middlename: { contains: s, mode: 'insensitive' } },
          { phone: { contains: s, mode: 'insensitive' } },
        ]
      }
    });
  }

  async listPaypointReferred(search?: string): Promise<any[]> {
    const s = search?.trim();
    const whereCondition: any = {
      OR: [{ patientQueue: 'paypoint' }, { patientStatus: 'paypoint' }],
    };

    if (s) {
      whereCondition.AND = [
        {
          OR: [
            { surname: { contains: s, mode: 'insensitive' } },
            { firstname: { contains: s, mode: 'insensitive' } },
            { middlename: { contains: s, mode: 'insensitive' } },
            { serviceNumber: { contains: s, mode: 'insensitive' } },
            { membershipNumber: { contains: s, mode: 'insensitive' } },
            { phone: { contains: s, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return this.prisma.patient.findMany({ where: whereCondition });
  }

  async listNHIAReferred(search?: string): Promise<any[]> {
    const s = search?.trim();
    const whereCondition: any = {
      OR: [
        { patientQueue: 'nhia' },
        { patientStatus: 'nhia' },
        { nhiaStatus: { in: ['cleared', 'not_cleared'] } },
      ],
    };

    if (s) {
      whereCondition.AND = [
        {
          OR: [
            { surname: { contains: s, mode: 'insensitive' } },
            { firstname: { contains: s, mode: 'insensitive' } },
            { middlename: { contains: s, mode: 'insensitive' } },
            { serviceNumber: { contains: s, mode: 'insensitive' } },
            { membershipNumber: { contains: s, mode: 'insensitive' } },
            { phone: { contains: s, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return this.prisma.patient.findMany({ where: whereCondition });
  }

  async getNHIAStats() {
    return this.getNHIAStatsByRange();
  }

  async getNHIAStatsByRange(opts?: { period?: 'daily' | 'monthly' | 'yearly'; value?: string }) {
    const now = new Date();
    const period = opts?.period || 'daily';
    const value = (opts?.value || '').trim();

    let start: Date;
    let end: Date;
    if (period === 'monthly') {
      const [yRaw, mRaw] = value ? value.split('-') : [];
      const y = Number(yRaw) || now.getFullYear();
      const m = Number(mRaw) || now.getMonth() + 1;
      start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      end = new Date(y, m, 1, 0, 0, 0, 0);
    } else if (period === 'yearly') {
      const y = Number(value) || now.getFullYear();
      start = new Date(y, 0, 1, 0, 0, 0, 0);
      end = new Date(y + 1, 0, 1, 0, 0, 0, 0);
    } else {
      const [yRaw, mRaw, dRaw] = value ? value.split('-') : [];
      const y = Number(yRaw) || now.getFullYear();
      const m = Number(mRaw) || now.getMonth() + 1;
      const d = Number(dRaw) || now.getDate();
      start = new Date(y, m - 1, d, 0, 0, 0, 0);
      end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    }

    const awaitingQuery: any = {
      OR: [{ patientQueue: 'nhia' }, { patientStatus: 'nhia' }],
      updatedAt: { gte: start, lt: end },
    };

    const clearedQuery: any = { nhiaStatus: 'cleared', nhiaUpdatedAt: { gte: start, lt: end } };
    const notClearedQuery: any = { nhiaStatus: 'not_cleared', nhiaUpdatedAt: { gte: start, lt: end } };

    const [
      awaiting,
      awaitingCivilian,
      awaitingPersonnel,
      cleared,
      clearedCivilian,
      clearedPersonnel,
      notCleared,
      notClearedCivilian,
      notClearedPersonnel,
    ] = await Promise.all([
      this.prisma.patient.count({ where: awaitingQuery }),
      this.prisma.patient.count({ where: { ...awaitingQuery, veteran: false } }),
      this.prisma.patient.count({ where: { ...awaitingQuery, veteran: true } }),
      this.prisma.patient.count({ where: clearedQuery }),
      this.prisma.patient.count({ where: { ...clearedQuery, veteran: false } }),
      this.prisma.patient.count({ where: { ...clearedQuery, veteran: true } }),
      this.prisma.patient.count({ where: notClearedQuery }),
      this.prisma.patient.count({ where: { ...notClearedQuery, veteran: false } }),
      this.prisma.patient.count({ where: { ...notClearedQuery, veteran: true } }),
    ]);

    return {
      period,
      value: value || (period === 'daily' ? start.toISOString().slice(0, 10) : period === 'monthly' ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}` : String(start.getFullYear())),
      awaiting,
      awaitingCivilian,
      awaitingPersonnel,
      cleared,
      clearedCivilian,
      clearedPersonnel,
      notCleared,
      notClearedCivilian,
      notClearedPersonnel,
    };
  }

  async listPharmacyReferred(search?: string): Promise<any[]> {
    const s = search?.trim();
    const whereCondition: any = {};
    if (s) {
      whereCondition.patient = {
        OR: [
          { surname: { contains: s, mode: 'insensitive' } },
          { firstname: { contains: s, mode: 'insensitive' } },
          { middlename: { contains: s, mode: 'insensitive' } },
          { serviceNumber: { contains: s, mode: 'insensitive' } },
          { membershipNumber: { contains: s, mode: 'insensitive' } },
          { phone: { contains: s, mode: 'insensitive' } },
        ]
      };
    }

    const pharmacyRecords = await this.prisma.pharmacyPatient.findMany({
      where: whereCondition,
    });

    const patientIds = Array.from(new Set(pharmacyRecords.map((x) => x.patientId).filter(Boolean)));
    const patients = await this.prisma.patient.findMany({
      where: { id: { in: patientIds } }
    });
    const patientMap = new Map<string, any>();
    for (const p of patients) patientMap.set(p.id, p);

    const invoiceByPatientId = new Map<string, any>();
    await Promise.all(
      patientIds.map(async (pid) => {
        const inv = await this.invoices.findLatestByPatientId(pid);
        if (inv) invoiceByPatientId.set(pid, inv);
      })
    );

    const admissions = await this.prisma.wardAdmission.findMany({
      where: { patientId: { in: patientIds }, status: 'admitted' }
    });
    const admissionByPatientId = new Map<string, any>();
    for (const a of admissions) admissionByPatientId.set(a.patientId, a);

    return pharmacyRecords.map((pp) => {
      const pid = pp.patientId;
      const p = patientMap.get(pid) || {};
      const inv = invoiceByPatientId.get(pid) || null;
      const admission = admissionByPatientId.get(pid) || null;

      const route = String(inv?.billingRoute || '');
      const paymentStatus = String(inv?.paymentStatus || '');
      const nhiaStampStatus = String(inv?.nhiaStampStatus || '');
      const copayStatus = String(inv?.copayStatus || '');
      const patientAmountDue = Number(inv?.patientAmountDue ?? 0) || 0;

      const cleared =
        !inv
          ? false
          : route === 'paypoint'
            ? paymentStatus === 'paid'
            : nhiaStampStatus === 'stamped' && (patientAmountDue <= 0 || copayStatus === 'paid');

      const drugs = Array.isArray(pp.drugs as any) ? (pp.drugs as any[]) : [];
      const hasBed = drugs.some((d) => String(d?.dosage || '').toLowerCase() === 'bed fee' || String(d?.category || '').toLowerCase() === 'bed');

      return {
        ...p,
        _id: p.id,
        deskState: pp.deskState,
        prescription: pp.prescription,
        drugs: pp.drugs,
        pharmacy: {
          deskState: pp.deskState,
          cleared,
          hasInvoice: !!inv,
          invoiceId: inv?.id ? String(inv.id) : '',
          billingRoute: route,
          paymentStatus,
          nhiaStampStatus,
          copayStatus,
          patientAmountDue,
          nhiaAmountDue: Number(inv?.nhiaAmountDue ?? 0) || 0,
          totalCost: Number(inv?.totalCost ?? 0) || 0,
          hasBed,
          admitted: !!admission,
          admittedWardUnit: admission ? String(admission.wardUnit || '') : '',
          admissionId: admission ? String(admission.id || '') : '',
        },
      };
    });
  }

  async addToPharmacy(patientId: string, data?: { prescription?: string; drugs?: any[] }): Promise<any> {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const updateData: any = {
      deskState: 'awaiting-dispense'
    };
    if (data?.prescription !== undefined) updateData.prescription = data.prescription;
    if (data?.drugs !== undefined) updateData.drugs = data.drugs;

    return this.prisma.pharmacyPatient.upsert({
      where: { patientId },
      create: {
        patientId,
        deskState: 'awaiting-dispense',
        prescription: data?.prescription || '',
        drugs: data?.drugs || []
      },
      update: updateData
    });
  }

  async updatePharmacyDeskState(patientId: string, deskState: string, data?: { prescription?: string; drugs?: any[] }): Promise<any> {
    const before = await this.prisma.pharmacyPatient.findUnique({ where: { patientId } });
    const updateData: any = { deskState };
    if (data?.prescription !== undefined) updateData.prescription = data.prescription;
    if (data?.drugs !== undefined) updateData.drugs = data.drugs;

    const nextDrugs = Array.isArray(data?.drugs) ? data?.drugs : undefined;
    const beforeDrugs = Array.isArray((before as any)?.drugs) ? (before as any).drugs : [];
    const isDispensingAttempt = (() => {
      if (!nextDrugs) return deskState === 'completed';
      const beforeMap = new Map<string, boolean>();
      for (const d of beforeDrugs) {
        const key = String(d?.priceItemId || d?.name || '');
        beforeMap.set(key, !!d?.dispensed);
      }
      for (const d of nextDrugs) {
        const key = String(d?.priceItemId || d?.name || '');
        const prev = beforeMap.get(key) || false;
        const next = !!d?.dispensed;
        if (!prev && next) return true;
      }
      return deskState === 'completed';
    })();

    if (isDispensingAttempt) {
      const clearance = await this.invoices.isInvoiceClearedForPharmacy(patientId);
      if (!clearance.ok) {
        throw new BadRequestException(String(clearance.reason || 'Invoice not cleared'));
      }
    }

    const doc = await this.prisma.pharmacyPatient.update({
      where: { patientId },
      data: updateData
    }).catch(() => null);

    if (!doc) throw new NotFoundException('Pharmacy patient not found');
    return doc;
  }

  async create(data: any): Promise<any> {
    const saved = await this.prisma.patient.create({ data });
    this.rt.emit('patient.created', {
      id: saved.id,
      patientStatus: saved.patientStatus,
      patientQueue: saved.patientQueue,
    });
    return saved;
  }

  async findById(id: string): Promise<any | null> {
    return this.prisma.patient.findUnique({ where: { id } });
  }

  async update(id: string, patch: any): Promise<any> {
    const before = await this.prisma.patient.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Patient not found');

    const doc = await this.prisma.patient.update({
      where: { id },
      data: patch
    });

    const patientId = doc.id;
    const inQueue = await this.gopdQueue.exists(patientId);
    if (doc.patientQueue === 'godp_vitals') {
      await this.gopdQueue.ensureFromPatient(doc);
    } else if (inQueue || before.patientQueue === 'godp_vitals') {
      await this.gopdQueue.remove(patientId);
    }

    this.rt.emit('patient.updated', {
      id: patientId,
      patientStatus: doc.patientStatus,
      patientQueue: doc.patientQueue,
      previousPatientStatus: before.patientStatus,
      previousPatientQueue: before.patientQueue,
    });
    return doc;
  }

  async remove(id: string): Promise<void> {
    const exists = await this.prisma.patient.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Patient not found');

    const res = await this.prisma.patient.delete({ where: { id } });
    await this.gopdQueue.remove(id);
    await this.prisma.pharmacyPatient.deleteMany({ where: { patientId: id } });
    this.rt.emit('patient.deleted', {
      id,
      patientStatus: res.patientStatus,
      patientQueue: res.patientQueue,
    });
  }

  async getNHIAAccess(patientId: string) {
    const doc = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!doc) throw new NotFoundException('Patient not found');

    const statusRaw = String(doc.nhiaStatus || '').trim().toLowerCase();
    const inDesk = String(doc.patientQueue || '').trim().toLowerCase() === 'nhia' || String(doc.patientStatus || '').trim().toLowerCase() === 'nhia';
    const updatedAt = doc.nhiaUpdatedAt || null;

    const status =
      statusRaw === 'cleared'
        ? 'cleared'
        : statusRaw === 'not_cleared'
          ? 'not_cleared'
          : inDesk || statusRaw === 'awaiting'
            ? 'awaiting'
            : 'unknown';

    return {
      patientId: doc.id,
      status,
      hasAccess: status === 'cleared',
      updatedAt
    };
  }
}
