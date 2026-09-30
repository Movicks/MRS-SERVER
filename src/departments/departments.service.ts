import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const wardUnits = ['ChildrenWard', 'FemaleWard', 'MaleWard', 'MaleVIP', 'FemaleVIP'];
    const names = ['Ward', ...wardUnits, 'Antenatal'];
    const existing = await this.prisma.department.findMany({ select: { name: true } });
    const normalize = (value: string) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');
    const existingKeys = new Set(existing.map((d) => normalize(String(d?.name || ''))).filter(Boolean));
    for (const name of names) {
      const key = normalize(name);
      if (existingKeys.has(key)) continue;
      await this.prisma.department.create({
        data: { name, bedCapacity: wardUnits.includes(name) ? 5 : undefined }
      });
      existingKeys.add(key);
    }
  }

  async list(): Promise<any[]> {
    return this.prisma.department.findMany();
  }

  async create(name: string, description?: string): Promise<any> {
    return this.prisma.department.create({
      data: { name, description }
    });
  }

  async update(id: string, patch: { name?: string; description?: string; bedCapacity?: number }): Promise<any> {
    if (patch.bedCapacity !== undefined && patch.bedCapacity !== null) {
      const v = Number(patch.bedCapacity);
      if (!Number.isFinite(v) || !Number.isInteger(v)) throw new BadRequestException('bedCapacity must be an integer');
      if (v < 5 || v > 50) throw new BadRequestException('bedCapacity must be between 5 and 50');
      patch.bedCapacity = v;
    }
    return this.prisma.department.update({
      where: { id },
      data: patch
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.department.delete({ where: { id } });
  }
}
