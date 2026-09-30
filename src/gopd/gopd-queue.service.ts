import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GopdQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureFromPatient(p: any): Promise<any> {
    const pid = String(p.id || p._id);
    const category = p.veteran ? 'personnel' : 'civilian';
    const cardNumber = p.veteran ? (p.serviceNumber || '') : (p.membershipNumber || '');
    const fullName = [p.surname, p.firstname, p.middlename].filter(Boolean).join(' ');
    const phone = p.phone || '';
    const rank = p.rank || '';

    return this.prisma.gopdQueue.upsert({
      where: { patientId: pid },
      create: {
        patientId: pid,
        category,
        cardNumber,
        fullName,
        phone,
        rank
      },
      update: {
        category,
        cardNumber,
        fullName,
        phone,
        rank
      }
    });
  }

  async list(): Promise<any[]> {
    return this.prisma.gopdQueue.findMany();
  }

  async add(patientId: string): Promise<any> {
    return this.prisma.gopdQueue.upsert({
      where: { patientId },
      create: { patientId },
      update: {}
    });
  }

  async remove(patientId: string): Promise<void> {
    await this.prisma.gopdQueue.deleteMany({ where: { patientId } });
  }

  async exists(patientId: string): Promise<boolean> {
    const count = await this.prisma.gopdQueue.count({ where: { patientId } });
    return count > 0;
  }
}
