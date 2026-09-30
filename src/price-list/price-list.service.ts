import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePriceItemDto } from './dto/create-price-item.dto';
import { UpdatePriceItemDto } from './dto/update-price-item.dto';

export type ListPriceItemsQuery = {
  q?: string;
  category?: string;
  activeOnly?: boolean;
};

export type SummaryPeriod = 'monthly' | 'yearly';

@Injectable()
export class PriceListService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListPriceItemsQuery): Promise<any[]> {
    const filter: any = {};

    if (query.category) {
      const raw = String(query.category || '').trim();
      if (raw) filter.category = { equals: raw, mode: 'insensitive' };
    }

    if (query.activeOnly) {
      filter.isActive = true;
    }

    if (query.q && query.q.trim().length > 0) {
      const search = query.q.trim();
      filter.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { unit: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.priceItem.findMany({
      where: filter,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
  }

  async findOne(id: string): Promise<any> {
    const doc = await this.prisma.priceItem.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Price item not found');
    return doc;
  }

  async create(dto: CreatePriceItemDto): Promise<any> {
    this.validatePrice(dto.price);
    this.validateQuantity(dto.stockQuantity);
    this.validateQuantity(dto.soldQuantity);
    if (String(dto.category || '').trim().toLowerCase() === 'bed') {
      this.validateBedQuantity(dto.stockQuantity);
      this.validateBedUsed(dto.soldQuantity, dto.stockQuantity);
      await this.ensureUniqueBedWard(dto.name, undefined);
    }

    const result = await this.prisma.priceItem.create({
      data: {
        name: dto.name.trim(),
        category: String(dto.category || '').trim().toLowerCase(),
        description: dto.description?.trim() || '',
        unit: dto.unit?.trim() || 'per item',
        price: dto.price,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        stockQuantity: dto.stockQuantity ?? 0,
        soldQuantity: dto.soldQuantity ?? 0,
      }
    });

    await this.recalculateAllSummaries();
    return result;
  }

  async update(id: string, dto: UpdatePriceItemDto): Promise<any> {
    const current = await this.prisma.priceItem.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Price item not found');

    const updateData: any = {};

    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.category !== undefined) updateData.category = String(dto.category || '').trim().toLowerCase();
    if (dto.description !== undefined) updateData.description = dto.description.trim();
    if (dto.unit !== undefined) updateData.unit = dto.unit.trim() || 'per item';
    if (dto.price !== undefined) {
      this.validatePrice(dto.price);
      updateData.price = dto.price;
    }
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.stockQuantity !== undefined) {
      this.validateQuantity(dto.stockQuantity);
      updateData.stockQuantity = dto.stockQuantity;
    }
    if (dto.soldQuantity !== undefined) {
      this.validateQuantity(dto.soldQuantity);
      updateData.soldQuantity = dto.soldQuantity;
    }

    const nextCategory = String((dto.category ?? current.category) || '').trim().toLowerCase();
    if (nextCategory === 'bed') {
      const nextStock = dto.stockQuantity ?? current.stockQuantity;
      const nextUsed = dto.soldQuantity ?? current.soldQuantity;
      this.validateBedQuantity(nextStock);
      this.validateBedUsed(nextUsed, nextStock);
      const nextName = String(dto.name ?? current.name ?? '');
      await this.ensureUniqueBedWard(nextName, id);
    }

    const doc = await this.prisma.priceItem.update({
      where: { id },
      data: updateData
    }).catch(() => null);

    if (!doc) throw new NotFoundException('Price item not found');
    await this.recalculateAllSummaries();
    return doc;
  }

  async recordDispense(id: string, quantity: number): Promise<any> {
    this.validateQuantity(quantity);
    if (quantity <= 0) {
      throw new BadRequestException('Dispensed quantity must be greater than zero');
    }

    const item = await this.prisma.priceItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Price item not found');

    const currentStock = Number(item.stockQuantity || 0);
    const nextSoldQuantity = (item.soldQuantity || 0) + quantity;
    let nextStock = currentStock;

    if (currentStock > 0) {
      if (quantity > currentStock) {
        throw new BadRequestException('Dispensed quantity exceeds available stock');
      }
      nextStock = currentStock - quantity;
    }

    const updated = await this.prisma.priceItem.update({
      where: { id },
      data: {
        stockQuantity: nextStock,
        soldQuantity: nextSoldQuantity
      }
    });

    await this.recalculateAllSummaries();
    return updated;
  }

  async remove(id: string) {
    const doc = await this.prisma.priceItem.delete({ where: { id } }).catch(() => null);
    if (!doc) throw new NotFoundException('Price item not found');
    await this.recalculateAllSummaries();
    return { ok: true };
  }

  async cloneMonth(input: {
    fromMonth: string;
    toMonth: string;
    overwrite?: boolean;
    resetSoldQuantity?: boolean;
    resetStockQuantity?: boolean;
  }) {
    const fromMonth = this.normalizeMonth(input.fromMonth);
    const toMonth = this.normalizeMonth(input.toMonth);
    if (!fromMonth || !toMonth) throw new BadRequestException('Invalid month format. Use YYYY-MM');
    if (fromMonth === toMonth) throw new BadRequestException('fromMonth and toMonth cannot be the same');

    const fromRange = this.monthRange(fromMonth);
    const toRange = this.monthRange(toMonth);

    const source = await this.prisma.priceItem.findMany({
      where: { createdAt: { gte: fromRange.start, lt: fromRange.end } }
    });

    if (!source.length) {
      throw new BadRequestException(`No price list items found for ${fromMonth}`);
    }

    const existingTargetCount = await this.prisma.priceItem.count({
      where: { createdAt: { gte: toRange.start, lt: toRange.end } }
    });

    if (existingTargetCount > 0 && !input.overwrite) {
      throw new BadRequestException(`Target month ${toMonth} already has ${existingTargetCount} items`);
    }

    let deletedCount = 0;
    if (existingTargetCount > 0 && input.overwrite) {
      const del = await this.prisma.priceItem.deleteMany({
        where: { createdAt: { gte: toRange.start, lt: toRange.end } }
      });
      deletedCount = del.count;
    }

    const resetSold = input.resetSoldQuantity ?? true;
    const resetStock = input.resetStockQuantity ?? false;

    const now = new Date();
    const docs = source.map((it: any) => ({
      name: String(it.name || '').trim(),
      category: String(it.category || '').trim().toLowerCase(),
      description: String(it.description || '').trim(),
      unit: String(it.unit || '').trim() || 'per item',
      price: Number(it.price) || 0,
      isActive: !!it.isActive,
      sortOrder: Number(it.sortOrder) || 0,
      stockQuantity: resetStock ? 0 : Number(it.stockQuantity) || 0,
      soldQuantity: resetSold ? 0 : Number(it.soldQuantity) || 0,
      createdAt: now,
      updatedAt: now,
    }));

    await this.prisma.priceItem.createMany({ data: docs });
    await this.recalculateAllSummaries();
    return {
      ok: true,
      fromMonth,
      toMonth,
      sourceCount: source.length,
      deletedCount,
      createdCount: docs.length,
    };
  }

  private validatePrice(price: number) {
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException('Price must be a valid non-negative number');
    }
  }

  private normalizeMonth(value: string) {
    const v = String(value || '').trim();
    if (!/^\d{4}-\d{2}$/.test(v)) return '';
    const [yRaw, mRaw] = v.split('-');
    const y = Number(yRaw);
    const m = Number(mRaw);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return '';
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
  }

  private monthRange(month: string) {
    const [yRaw, mRaw] = month.split('-');
    const y = Number(yRaw);
    const m = Number(mRaw);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0, 0);
    return { start, end };
  }

  private validateQuantity(quantity?: number) {
    if (quantity === undefined) return;
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new BadRequestException('Quantity must be a valid non-negative number');
    }
  }

  private validateBedQuantity(quantity?: number) {
    const q = Number(quantity);
    if (!Number.isFinite(q) || !Number.isInteger(q)) {
      throw new BadRequestException('Bed quantity must be an integer');
    }
    if (q < 5 || q > 50) {
      throw new BadRequestException('Bed quantity must be between 5 and 50');
    }
  }

  private validateBedUsed(used?: number, stock?: number) {
    const u = Number(used ?? 0);
    const s = Number(stock ?? 0);
    if (!Number.isFinite(u) || !Number.isInteger(u) || u < 0) {
      throw new BadRequestException('Used beds must be a non-negative integer');
    }
    if (!Number.isFinite(s) || !Number.isInteger(s) || s < 0) {
      throw new BadRequestException('In-stock beds must be a non-negative integer');
    }
    if (u > s) {
      throw new BadRequestException('Used beds cannot exceed in-stock beds');
    }
  }

  private extractBedWardKey(name: string) {
    const n = String(name || '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    if (n.includes('malevip')) return 'MaleVIP';
    if (n.includes('femalevip')) return 'FemaleVIP';
    if (n.includes('childrenward') || n.includes('children')) return 'ChildrenWard';
    if (n.includes('maleward')) return 'MaleWard';
    if (n.includes('femaleward')) return 'FemaleWard';
    return '';
  }

  private async ensureUniqueBedWard(name: string, currentId?: string) {
    const key = this.extractBedWardKey(name);
    if (!key) return;
    const list = await this.prisma.priceItem.findMany({
      where: { category: { equals: 'bed', mode: 'insensitive' } },
      select: { id: true, name: true }
    });
    const conflict = list.find((it: any) => {
      if (currentId && String(it.id) === String(currentId)) return false;
      return this.extractBedWardKey(String(it.name || '')) === key;
    });
    if (conflict) {
      throw new BadRequestException(`Bed fee for ${key} already exists`);
    }
  }

  async occupyBed(id: string, quantity: number): Promise<any> {
    const q = Number(quantity);
    if (!Number.isFinite(q) || !Number.isInteger(q) || q <= 0) {
      throw new BadRequestException('Quantity must be a positive integer');
    }
    const item = await this.prisma.priceItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Price item not found');
    if (String(item.category || '').trim().toLowerCase() !== 'bed') {
      throw new BadRequestException('Item is not a bed fee');
    }
    const stock = Number(item.stockQuantity || 0);
    this.validateBedQuantity(stock);
    const used = Number(item.soldQuantity || 0);
    const nextUsed = used + q;
    this.validateBedUsed(nextUsed, stock);
    const updated = await this.prisma.priceItem.update({
      where: { id },
      data: { soldQuantity: nextUsed }
    });
    await this.recalculateAllSummaries();
    return updated;
  }

  async releaseBed(id: string, quantity: number): Promise<any> {
    const q = Number(quantity);
    if (!Number.isFinite(q) || !Number.isInteger(q) || q <= 0) {
      throw new BadRequestException('Quantity must be a positive integer');
    }
    const item = await this.prisma.priceItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Price item not found');
    if (String(item.category || '').trim().toLowerCase() !== 'bed') {
      throw new BadRequestException('Item is not a bed fee');
    }
    const stock = Number(item.stockQuantity || 0);
    this.validateBedQuantity(stock);
    const used = Number(item.soldQuantity || 0);
    const nextUsed = used - q;
    this.validateBedUsed(nextUsed, stock);
    const updated = await this.prisma.priceItem.update({
      where: { id },
      data: { soldQuantity: nextUsed }
    });
    await this.recalculateAllSummaries();
    return updated;
  }

  private calculateSummaryFromItems(items: any[], period: SummaryPeriod, referenceDate: string) {
    let totalItems = 0;
    let activeItems = 0;
    let drugs = 0;
    let services = 0;
    let totalValue = 0;
    let servicesValue = 0;

    if (Array.isArray(items)) {
      totalItems = items.length;

      for (const item of items) {
        if (!item) continue;

        if (item.isActive) {
          activeItems++;
          const price = Number(item.price) || 0;
          const multiplier =
            item.category === 'drug' || String(item.category || '').trim().toLowerCase() === 'bed'
              ? Number(item.stockQuantity) || 0
              : 1;
          totalValue += price * multiplier;
          if (item.category !== 'drug') servicesValue += price * multiplier;
        }

        if (item.category === 'drug') {
          drugs++;
        } else {
          services++;
        }
      }
    }

    const totalDrugsInStock = items.reduce((sum, item) => {
      if (item?.category !== 'drug') return sum;
      return sum + (Number(item.stockQuantity) || 0);
    }, 0);

    const totalDrugsSold = items.reduce((sum, item) => {
      if (item?.category !== 'drug') return sum;
      return sum + (Number(item.soldQuantity) || 0);
    }, 0);

    const totalDrugsSoldValue = items.reduce((sum, item) => {
      if (item?.category !== 'drug') return sum;
      return sum + ((Number(item.soldQuantity) || 0) * (Number(item.price) || 0));
    }, 0);

    return {
      period,
      referenceDate,
      totalItems,
      activeItems,
      drugs,
      totalDrugs: drugs,
      services,
      servicesValue,
      totalValue,
      totalDrugsInStock,
      totalDrugsSold,
      totalDrugsSoldValue,
    };
  }

  private normalizeReferenceDate(period: SummaryPeriod, referenceDate?: string) {
    const raw = String(referenceDate || '').trim();
    if (!raw) return '';
    if (period === 'monthly') {
      if (/^\d{4}-\d{2}$/.test(raw)) return raw;
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 7);
      const d = new Date(raw);
      if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 7);
      return raw.slice(0, 7);
    }
    if (/^\d{4}$/.test(raw)) return raw;
    if (/^\d{4}-/.test(raw)) return raw.slice(0, 4);
    const d = new Date(raw);
    if (Number.isFinite(d.getTime())) return String(d.getFullYear());
    return raw.slice(0, 4);
  }

  private getRange(period: SummaryPeriod, referenceDate: string) {
    if (period === 'yearly') {
      const y = Number(referenceDate.slice(0, 4));
      const start = new Date(y, 0, 1, 0, 0, 0, 0);
      const end = new Date(y + 1, 0, 1, 0, 0, 0, 0);
      return { start, end };
    }
    const y = Number(referenceDate.slice(0, 4));
    const m = Number(referenceDate.slice(5, 7));
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0, 0);
    return { start, end };
  }

  private invoiceTotal(inv: any) {
    const total = Number(inv?.totalCost ?? 0);
    if (Number.isFinite(total) && total > 0) return total;
    const drugs = Array.isArray(inv?.drugs as any) ? (inv.drugs as any[]) : [];
    const items = Array.isArray(inv?.items as any) ? (inv.items as any[]) : [];
    const drugsTotal = drugs.reduce((s: number, it: any) => s + (Number(it?.totalPrice) || 0), 0);
    const itemsTotal = items.reduce((s: number, it: any) => s + (Number(it?.totalPrice) || 0), 0);
    return drugsTotal + itemsTotal;
  }

  private invoiceNHIAPortion(inv: any) {
    const nhiaAmountDue = Number(inv?.nhiaAmountDue ?? 0);
    if (Number.isFinite(nhiaAmountDue) && nhiaAmountDue > 0) return nhiaAmountDue;
    const total = this.invoiceTotal(inv);
    const patientDue = Number(inv?.patientAmountDue ?? 0) || 0;
    const computed = total - patientDue;
    return computed > 0 ? computed : 0;
  }

  private async getNHIAClearedValue(period: SummaryPeriod, referenceDate: string) {
    const { start, end } = this.getRange(period, referenceDate);

    const stampedNoCopay = await this.prisma.invoice.findMany({
      where: {
        billingRoute: 'nhia',
        nhiaStampStatus: 'stamped',
        patientAmountDue: { lte: 0 },
        OR: [
          { nhiaStampedAt: { gte: start, lt: end } },
          { updatedAt: { gte: start, lt: end } },
        ],
      },
      select: { totalCost: true, drugs: true, items: true, nhiaAmountDue: true, patientAmountDue: true }
    });

    const stampedWithCopay = await this.prisma.invoice.findMany({
      where: {
        billingRoute: 'nhia',
        nhiaStampStatus: 'stamped',
        patientAmountDue: { gt: 0 },
        copayStatus: 'paid',
        OR: [
          { copayPaidAt: { gte: start, lt: end } },
          { updatedAt: { gte: start, lt: end } },
        ],
      },
      select: { totalCost: true, drugs: true, items: true, nhiaAmountDue: true, patientAmountDue: true }
    });

    return [...stampedNoCopay, ...stampedWithCopay].reduce((sum, inv) => sum + this.invoiceNHIAPortion(inv), 0);
  }

  private async recalculateAllSummaries() {
    try {
      const items = await this.prisma.priceItem.findMany();
      const currentDate = new Date();
      const currentMonth = currentDate.toISOString().slice(0, 7);
      const currentYear = String(currentDate.getFullYear());

      const monthlySummary = this.calculateSummaryFromItems(items, 'monthly', currentMonth);
      const yearlySummary = this.calculateSummaryFromItems(items, 'yearly', currentYear);

      await this.prisma.priceListSummary.upsert({
        where: { period_referenceDate: { period: 'monthly', referenceDate: currentMonth } },
        create: monthlySummary,
        update: monthlySummary
      });

      await this.prisma.priceListSummary.upsert({
        where: { period_referenceDate: { period: 'yearly', referenceDate: currentYear } },
        create: yearlySummary,
        update: yearlySummary
      });
    } catch (error) {
      console.error('[PriceListService] recalculateAllSummaries error:', error);
    }
  }

  async getSummary(period: SummaryPeriod, referenceDate?: string): Promise<any> {
    const defaultRef = period === 'monthly' ? new Date().toISOString().slice(0, 7) : String(new Date().getFullYear());
    const ref = this.normalizeReferenceDate(period, referenceDate) || defaultRef;

    try {
      const existingSummary = await this.prisma.priceListSummary.findUnique({
        where: { period_referenceDate: { period, referenceDate: ref } }
      });
      const nhiaClearedValue = await this.getNHIAClearedValue(period, ref);

      if (existingSummary) {
        return {
          period: existingSummary.period,
          from: "",
          to: "",
          totalItems: existingSummary.totalItems,
          activeItems: existingSummary.activeItems,
          drugs: existingSummary.drugs,
          totalDrugs: existingSummary.totalDrugs,
          services: existingSummary.services,
          servicesValue: existingSummary.servicesValue,
          totalValue: existingSummary.totalValue,
          totalDrugsInStock: existingSummary.totalDrugsInStock,
          totalDrugsSold: existingSummary.totalDrugsSold,
          totalDrugsSoldValue: existingSummary.totalDrugsSoldValue,
          nhiaClearedValue,
        };
      }

      const items = await this.prisma.priceItem.findMany();
      const calculated = this.calculateSummaryFromItems(items, period, ref);
      const createdSummary = await this.prisma.priceListSummary.upsert({
        where: { period_referenceDate: { period, referenceDate: ref } },
        create: calculated,
        update: calculated
      });

      return {
        period: createdSummary.period,
        from: "",
        to: "",
        totalItems: createdSummary.totalItems,
        activeItems: createdSummary.activeItems,
        drugs: createdSummary.drugs,
        totalDrugs: createdSummary.totalDrugs,
        services: createdSummary.services,
        servicesValue: createdSummary.servicesValue,
        totalValue: createdSummary.totalValue,
        totalDrugsInStock: createdSummary.totalDrugsInStock,
        totalDrugsSold: createdSummary.totalDrugsSold,
        totalDrugsSoldValue: createdSummary.totalDrugsSoldValue,
        nhiaClearedValue,
      };
    } catch (error) {
      console.error('[PriceListService] getSummary error:', error);
      return {
        period,
        from: "",
        to: "",
        totalItems: 0,
        activeItems: 0,
        drugs: 0,
        totalDrugs: 0,
        services: 0,
        servicesValue: 0,
        totalValue: 0,
        totalDrugsInStock: 0,
        totalDrugsSold: 0,
        totalDrugsSoldValue: 0,
        nhiaClearedValue: 0,
      };
    }
  }

  async getSummaries(referenceDates?: { monthly?: string; yearly?: string }): Promise<Record<SummaryPeriod, any>> {
    const [monthly, yearly] = await Promise.all([
      this.getSummary('monthly', referenceDates?.monthly),
      this.getSummary('yearly', referenceDates?.yearly),
    ]);
    return { monthly, yearly };
  }

  async saveSummary(summaryData: any): Promise<any> {
    const { period, referenceDate, ...rest } = summaryData;
    return this.prisma.priceListSummary.upsert({
      where: { period_referenceDate: { period, referenceDate } },
      create: { period, referenceDate, ...rest },
      update: { period, referenceDate, ...rest }
    });
  }

  async getTopSellingDrugs(opts?: { limit?: number; activeOnly?: boolean }) {
    const limit = Math.min(Math.max(Number(opts?.limit || 5), 1), 50);
    const filter: any = { category: 'drug', soldQuantity: { gt: 0 } };
    if (opts?.activeOnly) filter.isActive = true;
    const docs = await this.prisma.priceItem.findMany({
      where: filter,
      orderBy: [{ soldQuantity: 'desc' }, { name: 'asc' }],
      take: limit
    });
    return docs.map((d) => ({
      _id: d.id,
      id: d.id,
      name: d.name || '',
      soldQuantity: Number(d.soldQuantity || 0),
      stockQuantity: Number(d.stockQuantity || 0),
      price: Number(d.price || 0),
      isActive: !!d.isActive,
      unit: d.unit || ''
    }));
  }
}
