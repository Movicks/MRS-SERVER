import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type TargetDepartment = 'EarDoctor' | 'EyeDoctor';

@Injectable()
export class ClinicalDayListService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeTargetDepartment(v: string): TargetDepartment {
    const raw = String(v || '').trim().toLowerCase();
    if (raw === 'eardoctor' || raw === 'ear') return 'EarDoctor';
    if (raw === 'eyedoctor' || raw === 'eye') return 'EyeDoctor';
    throw new BadRequestException('targetDepartment must be EarDoctor or EyeDoctor');
  }

  async add(patientId: string, targetDepartment: string, addedBy?: string, sourceDepartment?: string) {
    const target = this.normalizeTargetDepartment(targetDepartment);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const hasVitalsToday = await this.prisma.vitalSign.findFirst({
      where: { patientId, recordedAt: { gte: start, lt: end } }
    });
    if (!hasVitalsToday) throw new BadRequestException('Patient has no vitals recorded today');

    const existing = await this.prisma.clinicalDayList.findFirst({
      where: { patientId, targetDepartment: target, createdAt: { gte: start, lt: end } }
    });
    if (existing) return existing;

    return this.prisma.clinicalDayList.create({
      data: {
        patientId,
        targetDepartment: target,
        addedBy,
        sourceDepartment
      }
    });
  }

  async list(targetDepartment?: string, sourceDepartment?: string, range?: 'today' | 'all', start?: string, end?: string) {
    const q: any = {};
    if (range !== 'all') {
      const now = new Date();
      const s = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const e = end ? new Date(end) : new Date(s);
      if (!end) e.setDate(e.getDate() + 1);
      q.createdAt = { gte: s, lt: e };
    }
    if (targetDepartment) q.targetDepartment = this.normalizeTargetDepartment(targetDepartment);
    if (sourceDepartment) q.sourceDepartment = sourceDepartment;

    const docs = await this.prisma.clinicalDayList.findMany({ where: q });

    const patientIds = Array.from(new Set(docs.map((d) => d.patientId).filter(Boolean)));
    const patients = await this.prisma.patient.findMany({
      where: { id: { in: patientIds } }
    });
    const patientMap = new Map<string, any>();
    for (const p of patients) patientMap.set(p.id, p);

    const latestByPatientDept = new Map<string, any>();
    for (const d of docs) {
      const pid = d.patientId;
      const td = String(d.targetDepartment || '');
      const key = `${pid}:${td}`;
      const prev = latestByPatientDept.get(key);
      if (!prev || new Date(d.createdAt).getTime() > new Date(prev.createdAt).getTime()) {
        latestByPatientDept.set(key, d);
      }
    }
    const deduped = Array.from(latestByPatientDept.values());
    return deduped.map((d) => {
      const p = patientMap.get(d.patientId) || {};
      const fullName = [p.surname, p.firstname, p.middlename].filter(Boolean).join(' ');
      const phone = p.phone || '';
      const cardNumber = p.veteran ? (p.serviceNumber || '') : (p.membershipNumber || '');
      const rank = p.rank || '';
      return {
        patientId: d.patientId,
        fullName,
        phone,
        cardNumber,
        rank,
        sourceDepartment: d.sourceDepartment || '',
        targetDepartment: d.targetDepartment || '',
        createdAt: d.createdAt
      };
    });
  }
}
