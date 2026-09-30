import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export enum PaymentStatus {
  AWAITING = 'awaiting',
  PAID = 'paid',
  CANCELED = 'canceled',
}

export enum BillingRoute {
  PAYPOINT = 'paypoint',
  NHIA = 'nhia',
}

export enum NHIAStampStatus {
  AWAITING = 'awaiting',
  STAMPED = 'stamped',
}

export enum CopayStatus {
  AWAITING = 'awaiting',
  PAID = 'paid',
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rt: RealtimeGateway,
  ) {}

  async findAll(filters?: {
    createdByRole?: string;
    createdByUserId?: string;
    paymentStatus?: PaymentStatus;
    paidByRole?: string;
    paidFrom?: string;
    paidTo?: string;
    billingRoute?: BillingRoute;
    nhiaStampStatus?: NHIAStampStatus;
    copayStatus?: CopayStatus;
  }): Promise<any[]> {
    const q: any = {};
    if (filters?.createdByRole) q.createdByRole = String(filters.createdByRole).trim();
    if (filters?.createdByUserId) q.createdByUserId = filters.createdByUserId;
    if (filters?.paymentStatus) q.paymentStatus = filters.paymentStatus;
    if (filters?.paidByRole) q.paidByRole = String(filters.paidByRole).trim();
    if (filters?.billingRoute) q.billingRoute = filters.billingRoute;
    if (filters?.nhiaStampStatus) q.nhiaStampStatus = filters.nhiaStampStatus;
    if (filters?.copayStatus) q.copayStatus = filters.copayStatus;
    if (filters?.paidFrom || filters?.paidTo) {
      const range: any = {};
      if (filters.paidFrom) range.gte = new Date(filters.paidFrom);
      if (filters.paidTo) range.lt = new Date(filters.paidTo);
      q.paidAt = range;
    }
    return this.prisma.invoice.findMany({
      where: q,
      orderBy: { createdAt: 'desc' }
    });
  }

  private pickRole(rolesRaw: string[] | undefined, priority: string[]) {
    const roles = (rolesRaw || []).map((r) => {
      const v = String(r || '').trim().toLowerCase();
      return v === 'nurse' ? 'staff' : v;
    });
    return priority.find((r) => roles.includes(r)) || (roles[0] || '');
  }

  private isNHIAAccess(patient: any) {
    const status = String(patient?.nhiaStatus || '').trim().toLowerCase();
    return status === 'cleared';
  }

  async create(
    patientId: string,
    payload: { drugs?: any[]; items?: any[]; preferredBillingRoute?: BillingRoute },
    meta?: { createdByUserId?: string; roles?: string[] },
  ): Promise<any> {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const drugs = Array.isArray(payload.drugs) ? payload.drugs : [];
    const items = Array.isArray(payload.items) ? payload.items : [];

    const invoiceDrugs = drugs.map((drug) => ({
      priceItemId: String(drug.priceItemId || '').trim() || undefined,
      category: String(drug.category || '').trim() || undefined,
      unit: String(drug.unit || '').trim() || undefined,
      name: drug.name,
      dosage: drug.dosage,
      quantity: drug.quantity,
      instructions: drug.instructions,
      unitPrice: drug.unitPrice || 0,
      totalPrice: (drug.unitPrice || 0) * drug.quantity,
    }));

    const invoiceItems = items.map((item) => ({
      priceItemId: item.priceItemId,
      category: item.category,
      unit: item.unit,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice || 0,
      totalPrice: (item.unitPrice || 0) * item.quantity,
    }));

    const totalCost =
      invoiceDrugs.reduce((sum, d) => sum + (d.totalPrice || 0), 0) +
      invoiceItems.reduce((sum, d) => sum + (d.totalPrice || 0), 0);

    const patientCardNumber = patient.serviceNumber || patient.membershipNumber || patient.id;
    const patientName = [patient.surname, patient.firstname, patient.middlename].filter(Boolean).join(' ');

    const createdByRole = this.pickRole(meta?.roles, [
      'recording',
      'paypoint',
      'pharmacy',
      'doctor',
      'staff',
      'admin',
      'super_admin',
    ]);

    const patientIsPersonnel = !!patient.veteran;
    const patientHasNHIAAccess = this.isNHIAAccess(patient);
    const defaultRoute: BillingRoute = patientIsPersonnel || patientHasNHIAAccess ? BillingRoute.NHIA : BillingRoute.PAYPOINT;
    const preferred = String(payload.preferredBillingRoute || '').trim().toLowerCase();
    const billingRoute: BillingRoute =
      preferred === BillingRoute.PAYPOINT ? BillingRoute.PAYPOINT
        : preferred === BillingRoute.NHIA ? BillingRoute.NHIA
          : defaultRoute;

    const patientCopayPercent = billingRoute === BillingRoute.NHIA ? (patientIsPersonnel ? 0 : 10) : 100;
    const patientCopayAmount = Math.round((totalCost * patientCopayPercent) / 100);
    const patientAmountDue = billingRoute === BillingRoute.NHIA ? patientCopayAmount : totalCost;
    const nhiaAmountDue = billingRoute === BillingRoute.NHIA ? Math.max(0, totalCost - patientCopayAmount) : 0;

    if (billingRoute === BillingRoute.NHIA && !patientIsPersonnel && !patientHasNHIAAccess) {
      throw new BadRequestException('Patient has no NHIA access');
    }

    const saved = await this.prisma.invoice.create({
      data: {
        patientId,
        createdByUserId: meta?.createdByUserId,
        createdByRole,
        patientName,
        patientCardNumber,
        drugs: invoiceDrugs as any,
        items: invoiceItems as any,
        totalCost,
        billingRoute,
        patientIsPersonnel,
        patientHasNHIAAccess,
        patientCopayPercent,
        patientCopayAmount,
        patientAmountDue,
        nhiaAmountDue,
        copayStatus: billingRoute === BillingRoute.NHIA && patientAmountDue === 0 ? CopayStatus.PAID : CopayStatus.AWAITING,
        nhiaStampStatus: billingRoute === BillingRoute.NHIA ? NHIAStampStatus.AWAITING : NHIAStampStatus.AWAITING,
        paymentStatus: billingRoute === BillingRoute.PAYPOINT ? PaymentStatus.AWAITING : PaymentStatus.AWAITING,
      }
    });

    if (billingRoute === BillingRoute.NHIA) {
      await this.prisma.patient.update({
        where: { id: patientId },
        data: { patientStatus: 'nhia', patientQueue: 'nhia' }
      });
      this.rt.emit('patient.updated', {
        id: patientId,
        patientStatus: 'nhia',
        patientQueue: 'nhia',
      });
    }

    this.rt.emit('invoice.created', {
      id: saved.id,
      patientId: saved.patientId,
      paymentStatus: saved.paymentStatus,
      totalCost: saved.totalCost,
      billingRoute: saved.billingRoute,
    });
    return saved;
  }

  async findByPatientId(patientId: string): Promise<any[]> {
    return this.prisma.invoice.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findLatestByPatientId(patientId: string) {
    return this.prisma.invoice.findFirst({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string): Promise<any> {
    const doc = await this.prisma.invoice.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Invoice not found');
    return doc;
  }

  async updatePaymentStatus(id: string, status: PaymentStatus, meta?: { userId?: string; roles?: string[] }): Promise<any> {
    const before = await this.prisma.invoice.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Invoice not found');
    if (String(before.billingRoute || '') === BillingRoute.NHIA) {
      throw new BadRequestException('NHIA invoices cannot be paid via paypoint status');
    }

    const updateData: any = { paymentStatus: status };
    if (status === PaymentStatus.PAID) {
      const paidByRole = this.pickRole(meta?.roles, [
        'paypoint',
        'recording',
        'pharmacy',
        'doctor',
        'staff',
        'admin',
        'super_admin',
      ]);
      updateData.paidAt = new Date();
      updateData.paidByRole = paidByRole;
      updateData.paidByUserId = meta?.userId;
    } else {
      updateData.paidAt = null;
      updateData.paidByRole = '';
      updateData.paidByUserId = null;
    }

    const doc = await this.prisma.invoice.update({
      where: { id },
      data: updateData
    });
    this.rt.emit('invoice.updated', {
      id: doc.id,
      patientId: doc.patientId,
      paymentStatus: doc.paymentStatus,
      totalCost: doc.totalCost,
      billingRoute: doc.billingRoute,
    });
    if (status === PaymentStatus.PAID) {
      await this.prisma.patient.update({
        where: { id: doc.patientId },
        data: { patientStatus: 'ok', patientQueue: '' }
      });
      this.rt.emit('patient.updated', {
        id: doc.patientId,
        patientStatus: 'ok',
        patientQueue: '',
      });
    }
    return doc;
  }

  async stampNHIA(id: string, meta?: { userId?: string; roles?: string[] }) {
    const before = await this.prisma.invoice.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Invoice not found');
    if (String(before.billingRoute || '') !== BillingRoute.NHIA) {
      throw new BadRequestException('Invoice is not routed to NHIA');
    }
    const due = Number(before.patientAmountDue || 0);
    const copayStatus = String(before.copayStatus || '');
    if (due > 0 && copayStatus !== CopayStatus.PAID) {
      throw new BadRequestException('Awaiting 10% payment confirmation from paypoint');
    }
    const role = this.pickRole(meta?.roles, ['staff', 'admin', 'super_admin']);
    const saved = await this.prisma.invoice.update({
      where: { id },
      data: {
        nhiaStampStatus: NHIAStampStatus.STAMPED,
        nhiaStampedAt: new Date(),
        nhiaStampedByRole: role,
        nhiaStampedByUserId: meta?.userId
      }
    });
    this.rt.emit('invoice.updated', {
      id: saved.id,
      patientId: saved.patientId,
      paymentStatus: saved.paymentStatus,
      totalCost: saved.totalCost,
      billingRoute: saved.billingRoute,
    });
    return saved;
  }

  async markCopayPaid(id: string, meta?: { userId?: string; roles?: string[] }) {
    const before = await this.prisma.invoice.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Invoice not found');
    if (String(before.billingRoute || '') !== BillingRoute.NHIA) {
      throw new BadRequestException('Invoice is not routed to NHIA');
    }
    if (Number(before.patientAmountDue || 0) <= 0) {
      const saved0 = await this.prisma.invoice.update({
        where: { id },
        data: { copayStatus: CopayStatus.PAID }
      });
      this.rt.emit('invoice.updated', {
        id: saved0.id,
        patientId: saved0.patientId,
        paymentStatus: saved0.paymentStatus,
        totalCost: saved0.totalCost,
        billingRoute: saved0.billingRoute,
      });
      return saved0;
    }
    const role = this.pickRole(meta?.roles, ['staff', 'paypoint', 'admin', 'super_admin']);
    const saved = await this.prisma.invoice.update({
      where: { id },
      data: {
        copayStatus: CopayStatus.PAID,
        copayPaidAt: new Date(),
        copayPaidByRole: role,
        copayPaidByUserId: meta?.userId
      }
    });
    this.rt.emit('invoice.updated', {
      id: saved.id,
      patientId: saved.patientId,
      paymentStatus: saved.paymentStatus,
      totalCost: saved.totalCost,
      billingRoute: saved.billingRoute,
    });
    return saved;
  }

  async updateItems(id: string, items: any[], meta?: { userId?: string; roles?: string[] }) {
    const doc = await this.prisma.invoice.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Invoice not found');
    if (doc.paymentStatus === PaymentStatus.CANCELED) {
      throw new BadRequestException('Invoice is canceled');
    }

    const route = String(doc.billingRoute || '');
    if (route === BillingRoute.PAYPOINT && doc.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Paid invoices cannot be modified');
    }
    if (route === BillingRoute.NHIA && String(doc.nhiaStampStatus || '') === NHIAStampStatus.STAMPED) {
      throw new BadRequestException('Stamped NHIA invoices cannot be modified');
    }

    const safeItems = Array.isArray(items) ? items : [];
    const invoiceItems = safeItems.map((item) => ({
      priceItemId: item.priceItemId,
      category: item.category,
      unit: item.unit,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice || 0,
      totalPrice: (item.unitPrice || 0) * item.quantity,
    }));

    const invoiceDrugs = Array.isArray(doc.drugs as any) ? (doc.drugs as any[]) : [];
    const drugsTotal = invoiceDrugs.reduce((sum: number, d: any) => sum + (Number(d.totalPrice || 0) || 0), 0);
    const itemsTotal = invoiceItems.reduce((sum, d) => sum + (Number(d.totalPrice || 0) || 0), 0);
    const totalCost = drugsTotal + itemsTotal;

    const patientIsPersonnel = !!doc.patientIsPersonnel;
    const patientHasNHIAAccess = !!doc.patientHasNHIAAccess;

    if (route === BillingRoute.NHIA && !patientIsPersonnel && !patientHasNHIAAccess) {
      throw new BadRequestException('Patient has no NHIA access');
    }

    const patientCopayPercent = route === BillingRoute.NHIA ? (patientIsPersonnel ? 0 : 10) : 100;
    const patientCopayAmount = Math.round((totalCost * patientCopayPercent) / 100);
    const patientAmountDue = route === BillingRoute.NHIA ? patientCopayAmount : totalCost;
    const nhiaAmountDue = route === BillingRoute.NHIA ? Math.max(0, totalCost - patientCopayAmount) : 0;

    const updateData: any = {
      items: invoiceItems as any,
      totalCost,
      patientCopayPercent,
      patientCopayAmount,
      patientAmountDue,
      nhiaAmountDue,
    };

    if (route === BillingRoute.NHIA) {
      if (patientAmountDue <= 0) {
        updateData.copayStatus = CopayStatus.PAID;
        updateData.copayPaidAt = null;
        updateData.copayPaidByRole = '';
        updateData.copayPaidByUserId = null;
      } else {
        updateData.copayStatus = CopayStatus.AWAITING;
        updateData.copayPaidAt = null;
        updateData.copayPaidByRole = '';
        updateData.copayPaidByUserId = null;
      }
    }

    const saved = await this.prisma.invoice.update({
      where: { id },
      data: updateData
    });
    this.rt.emit('invoice.updated', {
      id: saved.id,
      patientId: saved.patientId,
      paymentStatus: saved.paymentStatus,
      totalCost: saved.totalCost,
      billingRoute: saved.billingRoute,
    });
    return saved;
  }

  async cancelInvoice(id: string, meta?: { userId?: string; roles?: string[] }) {
    const doc = await this.prisma.invoice.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Invoice not found');
    if (doc.paymentStatus === PaymentStatus.CANCELED) return doc;

    const route = String(doc.billingRoute || '');
    if (route === BillingRoute.PAYPOINT && doc.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Paid invoices cannot be canceled');
    }
    if (route === BillingRoute.NHIA && String(doc.nhiaStampStatus || '') === NHIAStampStatus.STAMPED) {
      throw new BadRequestException('Stamped NHIA invoices cannot be canceled');
    }

    const saved = await this.prisma.invoice.update({
      where: { id },
      data: {
        paymentStatus: PaymentStatus.CANCELED,
        paidAt: null,
        paidByRole: '',
        paidByUserId: null,
        items: [] as any,
        drugs: [] as any,
        totalCost: 0,
        patientCopayPercent: 0,
        patientCopayAmount: 0,
        patientAmountDue: 0,
        nhiaAmountDue: 0,
        copayStatus: CopayStatus.PAID,
        copayPaidAt: null,
        copayPaidByRole: '',
        copayPaidByUserId: null,
        nhiaStampStatus: NHIAStampStatus.AWAITING,
        nhiaStampedAt: null,
        nhiaStampedByRole: '',
        nhiaStampedByUserId: null,
      }
    });

    this.rt.emit('invoice.updated', {
      id: saved.id,
      patientId: saved.patientId,
      paymentStatus: saved.paymentStatus,
      totalCost: saved.totalCost,
      billingRoute: saved.billingRoute,
    });

    await this.prisma.patient.update({
      where: { id: saved.patientId },
      data: { patientStatus: 'ok', patientQueue: '' }
    });

    this.rt.emit('patient.updated', {
      id: saved.patientId,
      patientStatus: 'ok',
      patientQueue: '',
    });

    return saved;
  }

  async isInvoiceClearedForPharmacy(patientId: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });

    if (!inv) return { ok: false, reason: 'No invoice found' };
    if (String(inv.paymentStatus || '') === PaymentStatus.CANCELED) {
      return { ok: false, reason: 'Invoice canceled', invoice: inv };
    }

    const route = String(inv.billingRoute || '');
    if (route === BillingRoute.PAYPOINT) {
      if (inv.paymentStatus === PaymentStatus.PAID) return { ok: true, invoice: inv };
      return { ok: false, reason: 'Awaiting payment at paypoint', invoice: inv };
    }

    const stamped = String(inv.nhiaStampStatus || '') === NHIAStampStatus.STAMPED;
    if (!stamped) return { ok: false, reason: 'Awaiting NHIA stamp', invoice: inv };

    const due = Number(inv.patientAmountDue || 0);
    if (due > 0 && String(inv.copayStatus || '') !== CopayStatus.PAID) {
      return { ok: false, reason: 'Awaiting NHIA copay payment', invoice: inv };
    }
    return { ok: true, invoice: inv };
  }
}
