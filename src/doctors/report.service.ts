import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService
  ) {}

  async add(payload: { patientId: string; senderId: string; text?: string; clinicalNote?: string; diagnosis?: string; imageUrl?: string; replyToId?: string; senderName?: string }) {
    if (!payload.text && !payload.clinicalNote && !payload.diagnosis && !payload.imageUrl) {
      throw new BadRequestException('clinical note, diagnosis, text or imageUrl required');
    }
    const sender = await this.usersService.findById(payload.senderId);
    const fallbackSenderName = String(payload.senderName || '').trim();
    const saved = await this.prisma.doctorReport.create({
      data: {
        patientId: payload.patientId,
        senderId: payload.senderId,
        senderName: sender?.name || sender?.email || fallbackSenderName || '',
        text: payload.text,
        clinicalNote: payload.clinicalNote,
        diagnosis: payload.diagnosis,
        imageUrl: payload.imageUrl,
        replyToId: payload.replyToId,
      }
    });
    return this.mapReport(saved, sender);
  }

  async list(patientId: string) {
    const list = await this.prisma.doctorReport.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });

    const senderIds = Array.from(new Set(list.map((r) => r.senderId).filter(Boolean)));
    const senders = await this.prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, name: true, email: true }
    });
    const senderMap = new Map<string, any>();
    for (const s of senders) senderMap.set(s.id, s);

    return list.map((r) => this.mapReport(r, senderMap.get(r.senderId)));
  }

  async update(id: string, payload: { text?: string; clinicalNote?: string; diagnosis?: string; imageUrl?: string }) {
    const update: any = {};
    if (payload.text !== undefined) update.text = payload.text;
    if (payload.clinicalNote !== undefined) update.clinicalNote = payload.clinicalNote;
    if (payload.diagnosis !== undefined) update.diagnosis = payload.diagnosis;
    if (payload.imageUrl !== undefined) update.imageUrl = payload.imageUrl;
    const saved = await this.prisma.doctorReport.update({
      where: { id },
      data: update
    }).catch(() => null);

    if (!saved) throw new BadRequestException('Report not found');
    const sender = await this.prisma.user.findUnique({
      where: { id: saved.senderId },
      select: { id: true, name: true, email: true }
    });
    return this.mapReport(saved, sender);
  }

  async remove(id: string) {
    const res = await this.prisma.doctorReport.delete({ where: { id } }).catch(() => null);
    if (!res) throw new BadRequestException('Report not found');
    return { id };
  }

  private mapReport(r: any, senderObj?: any) {
    const senderName = String(r.senderName ?? senderObj?.name ?? senderObj?.email ?? '').trim();
    return {
      id: r.id,
      patientId: r.patientId,
      senderId: r.senderId,
      senderName: senderName || 'Unknown',
      doctorName: senderName || 'Unknown',
      text: r.text,
      clinicalNote: r.clinicalNote || r.text,
      diagnosis: r.diagnosis,
      imageUrl: r.imageUrl,
      replyToId: r.replyToId || undefined,
      createdAt: r.createdAt,
    };
  }
}
