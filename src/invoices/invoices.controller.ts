import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { CommandBus } from '@nestjs/cqrs';
import { InvoicesService } from './invoices.service';
import { BillingRoute, CopayStatus, NHIAStampStatus, PaymentStatus } from './invoice.schema';
import {
  CancelInvoiceCommand,
  CreateInvoiceCommand,
  MarkInvoiceCopayPaidCommand,
  StampInvoiceNHIACommand,
  UpdateInvoiceItemsCommand,
  UpdateInvoicePaymentStatusCommand
} from './cqrs/invoices.commands';
import { InvoicesReplayService } from './projection/invoices-replay.service';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly commandBus: CommandBus,
    private readonly replay: InvoicesReplayService
  ) {}

  @Roles(
    'super_admin' as Role,
    'admin' as Role,
    'paypoint' as Role,
    'doctor' as Role,
    'staff' as Role,
    'clinical' as Role,
    'recording' as Role,
  )
  @Get()
  async findAll(
    @Query('createdByRole') createdByRole?: string,
    @Query('createdByUserId') createdByUserId?: string,
    @Query('paymentStatus') paymentStatus?: PaymentStatus,
    @Query('paidByRole') paidByRole?: string,
    @Query('paidFrom') paidFrom?: string,
    @Query('paidTo') paidTo?: string,
    @Query('billingRoute') billingRoute?: BillingRoute,
    @Query('nhiaStampStatus') nhiaStampStatus?: NHIAStampStatus,
    @Query('copayStatus') copayStatus?: CopayStatus,
  ) {
    return this.invoicesService.findAll({
      createdByRole,
      createdByUserId,
      paymentStatus,
      paidByRole,
      paidFrom,
      paidTo,
      billingRoute,
      nhiaStampStatus,
      copayStatus
    });
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'clinical' as Role, 'pharmacy' as Role, 'staff' as Role, 'recording' as Role)
  @Post()
  async create(@Req() req: any, @Body() body: { patientId: string; drugs?: any[]; items?: any[]; preferredBillingRoute?: BillingRoute }) {
    const createdByUserId = req?.user?.sub as string;
    const roles: string[] = (req?.user?.roles || []) as string[];
    return this.commandBus.execute(new CreateInvoiceCommand(body, { userId: createdByUserId, roles }));
  }

  @Roles(
    'super_admin' as Role,
    'admin' as Role,
    'paypoint' as Role,
    'doctor' as Role,
    'clinical' as Role,
    'pharmacy' as Role,
    'staff' as Role,
    'recording' as Role,
  )
  @Get('patient/:patientId')
  async findByPatientId(@Param('patientId') patientId: string) {
    return this.invoicesService.findByPatientId(patientId);
  }

  @Roles(
    'super_admin' as Role,
    'admin' as Role,
    'paypoint' as Role,
    'doctor' as Role,
    'clinical' as Role,
    'pharmacy' as Role,
    'staff' as Role,
    'recording' as Role,
  )
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Roles(
    'super_admin' as Role,
    'admin' as Role,
    'paypoint' as Role,
    'doctor' as Role,
    'staff' as Role,
    'recording' as Role,
  )
  @Patch(':id/payment-status')
  async updatePaymentStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { paymentStatus: PaymentStatus },
  ) {
    const userId = req?.user?.sub as string;
    const roles: string[] = (req?.user?.roles || []) as string[];
    return this.commandBus.execute(new UpdateInvoicePaymentStatusCommand(id, body.paymentStatus, { userId, roles }));
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'clinical' as Role, 'staff' as Role)
  @Patch(':id/items')
  async updateItems(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { items: any[] },
  ) {
    const userId = req?.user?.sub as string;
    const roles: string[] = (req?.user?.roles || []) as string[];
    return this.commandBus.execute(new UpdateInvoiceItemsCommand(id, Array.isArray(body.items) ? body.items : [], { userId, roles }));
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'clinical' as Role, 'staff' as Role)
  @Patch(':id/cancel')
  async cancel(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req?.user?.sub as string;
    const roles: string[] = (req?.user?.roles || []) as string[];
    return this.commandBus.execute(new CancelInvoiceCommand(id, { userId, roles }));
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'staff' as Role)
  @Patch(':id/nhia/stamp')
  async stampNHIA(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req?.user?.sub as string;
    const roles: string[] = (req?.user?.roles || []) as string[];
    return this.commandBus.execute(new StampInvoiceNHIACommand(id, { userId, roles }));
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'staff' as Role, 'paypoint' as Role)
  @Patch(':id/nhia/copay-paid')
  async markCopayPaid(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const userId = req?.user?.sub as string;
    const roles: string[] = (req?.user?.roles || []) as string[];
    return this.commandBus.execute(new MarkInvoiceCopayPaidCommand(id, { userId, roles }));
  }

  @Roles('super_admin' as Role)
  @Post('replay')
  async replayProjection() {
    return this.replay.rebuildFromEvents();
  }
}
