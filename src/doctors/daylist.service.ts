import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DayListService {
  constructor(private readonly prisma: PrismaService) {}

  async add(patientId: string, addedBy?: string, sourceDepartment?: string) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const hasVitalsToday = await this.prisma.vitalSign.findFirst({
      where: { patientId, recordedAt: { gte: start, lt: end } }
    });
    if (!hasVitalsToday) throw new BadRequestException('Patient has no vitals recorded today');

    const existing = await this.prisma.doctorDayList.findFirst({
      where: { patientId, createdAt: { gte: start, lt: end } }
    });
    if (existing) return existing;

    return this.prisma.doctorDayList.create({
      data: { patientId, addedBy, sourceDepartment }
    });
  }

  async list(sourceDepartment?: string, range?: 'today' | 'all', start?: string, end?: string) {
    const q: any = {};
    if (range !== 'all') {
      const now = new Date();
      const s = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const e = end ? new Date(end) : new Date(s);
      if (!end) e.setDate(e.getDate() + 1);
      q.createdAt = { gte: s, lt: e };
    }
    if (sourceDepartment) q.sourceDepartment = sourceDepartment;

    const docs = await this.prisma.doctorDayList.findMany({ where: q });

    const patientIds = Array.from(new Set(docs.map((d) => d.patientId).filter(Boolean)));
    const patients = await this.prisma.patient.findMany({
      where: { id: { in: patientIds } }
    });
    const patientMap = new Map<string, any>();
    for (const p of patients) patientMap.set(p.id, p);

    const latestByPatient = new Map<string, any>();
    for (const d of docs) {
      const pid = d.patientId;
      const prev = latestByPatient.get(pid);
      if (!prev || new Date(d.createdAt).getTime() > new Date(prev.createdAt).getTime()) {
        latestByPatient.set(pid, d);
      }
    }
    const deduped = Array.from(latestByPatient.values());
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
        createdAt: d.createdAt,
      };
    });
  }
}
