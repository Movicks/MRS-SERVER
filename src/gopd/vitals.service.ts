import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VitalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: {
    patientId: string;
    recordedBy?: string;
    recordedAt?: string;
    temperature?: number;
    pulse?: number;
    respirationRate?: number;
    bp?: string;
    spo2?: number;
    fbsRbs?: string;
    height?: number;
    weight?: number;
  }) {
    const recordedAt = payload.recordedAt ? new Date(payload.recordedAt) : new Date();
    const saved = await this.prisma.vitalSign.create({
      data: {
        patientId: payload.patientId,
        recordedBy: payload.recordedBy,
        recordedAt,
        temperature: payload.temperature,
        pulse: payload.pulse,
        respirationRate: payload.respirationRate,
        bp: payload.bp,
        spo2: payload.spo2,
        fbsRbs: payload.fbsRbs,
        height: payload.height,
        weight: payload.weight,
      }
    });
    return this.mapWithYMD(saved);
  }

  async listForPatient(patientId: string) {
    const list = await this.prisma.vitalSign.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' }
    });
    return list.map(this.mapWithYMD);
  }

  private mapWithYMD = (v: any) => {
    const d = new Date(v.recordedAt);
    return {
      ...v,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    };
  };
}
