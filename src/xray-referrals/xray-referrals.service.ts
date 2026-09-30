import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export enum XrayReferralStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  COMPLETED = 'COMPLETED',
}

type CreateReferralDto = {
  patientId: string;
  senderId: string;
  invoiceId?: string;
  date: string;
  serviceNoOrUUID?: string;
  rank?: string;
  forenames?: string;
  surname?: string;
  wardNo?: string;
  hospitalUnit?: string;
  age?: string;
  to?: string;
  imagingArea?: string;
  examinationRequired?: string;
  diagnosis?: string;
  statement?: string;
  previousReportNos?: string;
  previousReportDate?: string;
};

type XrayTestResultsDto = {
  testResults: Record<string, string>;
};

@Injectable()
export class XrayReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReferralDto): Promise<any> {
    const date = new Date(dto.date || new Date().toISOString());
    const prevDate = dto.previousReportDate ? new Date(dto.previousReportDate) : undefined;
    return this.prisma.xrayReferral.create({
      data: {
        patientId: dto.patientId,
        senderId: dto.senderId,
        invoiceId: dto.invoiceId,
        date,
        serviceNoOrUUID: dto.serviceNoOrUUID,
        rank: dto.rank,
        forenames: dto.forenames,
        surname: dto.surname,
        wardNo: dto.wardNo,
        hospitalUnit: dto.hospitalUnit,
        age: dto.age,
        to: dto.to,
        imagingArea: dto.imagingArea,
        examinationRequired: dto.examinationRequired,
        diagnosis: dto.diagnosis,
        statement: dto.statement,
        previousReportNos: dto.previousReportNos,
        previousReportDate: prevDate,
        testResults: {},
        status: XrayReferralStatus.PENDING,
      }
    });
  }

  async list(filters: { status?: XrayReferralStatus; q?: string; date?: string; patientId?: string; period?: 'daily' | 'monthly' | 'yearly'; value?: string }): Promise<any[]> {
    const q: any = {};
    if (filters.status) q.status = filters.status;
    if (filters.patientId) q.patientId = String(filters.patientId);

    if (filters.date) {
      const d = new Date(filters.date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      q.date = { gte: d, lt: next };
    } else if (filters.period || filters.value) {
      const now = new Date();
      const period = filters.period || 'daily';
      const value = (filters.value || '').trim();

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

      q.date = { gte: start, lt: end };
    }

    const list = await this.prisma.xrayReferral.findMany({
      where: q,
      orderBy: { createdAt: 'desc' }
    });

    const senderIds = Array.from(new Set(list.map((r) => r.senderId).filter(Boolean)));
    const invoiceIds = Array.from(new Set(list.map((r) => r.invoiceId).filter((id): id is string => !!id)));

    const [senders, invoices] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true, email: true } }),
      this.prisma.invoice.findMany({ where: { id: { in: invoiceIds } } })
    ]);

    const senderMap = new Map<string, any>();
    for (const s of senders) senderMap.set(s.id, s);
    const invoiceMap = new Map<string, any>();
    for (const inv of invoices) invoiceMap.set(inv.id, inv);

    return list.map((r) => this.mapReferral(r, senderMap.get(r.senderId), r.invoiceId ? invoiceMap.get(r.invoiceId) : null));
  }

  async listForPatient(
    patientId: string,
    filters?: { status?: XrayReferralStatus; period?: 'daily' | 'monthly' | 'yearly'; value?: string },
  ): Promise<any[]> {
    const now = new Date();
    const period = filters?.period || 'daily';
    const value = (filters?.value || '').trim();

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

    const q: any = { patientId };
    if (filters?.status) q.status = filters.status;
    q.date = { gte: start, lt: end };

    const list = await this.prisma.xrayReferral.findMany({
      where: q,
      orderBy: { createdAt: 'desc' }
    });

    const senderIds = Array.from(new Set(list.map((r) => r.senderId).filter(Boolean)));
    const invoiceIds = Array.from(new Set(list.map((r) => r.invoiceId).filter((id): id is string => !!id)));

    const [senders, invoices] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true, email: true } }),
      this.prisma.invoice.findMany({ where: { id: { in: invoiceIds } } })
    ]);

    const senderMap = new Map<string, any>();
    for (const s of senders) senderMap.set(s.id, s);
    const invoiceMap = new Map<string, any>();
    for (const inv of invoices) invoiceMap.set(inv.id, inv);

    return list.map((r) => this.mapReferral(r, senderMap.get(r.senderId), r.invoiceId ? invoiceMap.get(r.invoiceId) : null));
  }

  async setStatus(id: string, status: XrayReferralStatus): Promise<any> {
    if (!Object.values(XrayReferralStatus).includes(status)) throw new BadRequestException('Invalid status');
    if (status === XrayReferralStatus.RECEIVED || status === XrayReferralStatus.COMPLETED) {
      const ref = await this.prisma.xrayReferral.findUnique({ where: { id } });
      if (!ref) throw new BadRequestException('Referral not found');
      const invoiceId = String(ref.invoiceId || '').trim();
      if (!invoiceId) throw new BadRequestException('Invoice not found for referral');
      const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
      const clearance = this.computeClearance(inv);
      if (!clearance.isCleared) throw new BadRequestException('Patient has not been cleared for this request');
    }
    const saved = await this.prisma.xrayReferral.update({
      where: { id },
      data: { status }
    }).catch(() => null);
    if (!saved) throw new BadRequestException('Referral not found');
    return { id: saved.id, status: saved.status };
  }

  async updateResults(id: string, dto: XrayTestResultsDto): Promise<any> {
    const saved = await this.prisma.xrayReferral.update({
      where: { id },
      data: { testResults: dto.testResults || {} }
    }).catch(() => null);

    if (!saved) throw new BadRequestException('Referral not found');
    return {
      id: saved.id,
      testResults: saved.testResults || {},
    };
  }

  private mapReferral(r: any, senderObj?: any, invoiceObj?: any) {
    const clearance = this.computeClearance(invoiceObj);
    return {
      id: r.id,
      patientId: r.patientId,
      senderId: r.senderId,
      senderName: senderObj?.name,
      senderEmail: senderObj?.email,
      invoiceId: invoiceObj?.id || r.invoiceId || undefined,
      billingRoute: invoiceObj?.billingRoute,
      paymentStatus: invoiceObj?.paymentStatus,
      nhiaStampStatus: invoiceObj?.nhiaStampStatus,
      copayStatus: invoiceObj?.copayStatus,
      patientAmountDue: invoiceObj?.patientAmountDue,
      isCleared: clearance.isCleared,
      clearanceLabel: clearance.label,
      date: r.date,
      serviceNoOrUUID: r.serviceNoOrUUID,
      rank: r.rank,
      forenames: r.forenames,
      surname: r.surname,
      wardNo: r.wardNo,
      hospitalUnit: r.hospitalUnit,
      age: r.age,
      to: r.to,
      imagingArea: r.imagingArea,
      examinationRequired: r.examinationRequired,
      diagnosis: r.diagnosis,
      statement: r.statement,
      previousReportNos: r.previousReportNos,
      previousReportDate: r.previousReportDate,
      testResults: r.testResults || {},
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private computeClearance(inv: any | null | undefined): { isCleared: boolean; label: string } {
    if (!inv) return { isCleared: false, label: 'No Invoice' };
    const route = String(inv.billingRoute || '').toLowerCase();
    if (route === 'paypoint') {
      const paid = String(inv.paymentStatus || '') === 'paid';
      return { isCleared: paid, label: paid ? 'Paid' : 'Awaiting Payment' };
    }

    const stamped = String(inv.nhiaStampStatus || '') === 'stamped';
    if (!stamped) {
      const due = Number(inv.patientAmountDue ?? 0) || 0;
      if (due > 0 && String(inv.copayStatus || '') !== 'paid') {
        return { isCleared: false, label: 'Awaiting 10% Payment' };
      }
      return { isCleared: false, label: 'Awaiting NHIA Stamp' };
    }
    return { isCleared: true, label: 'NHIA Cleared' };
  }
}
