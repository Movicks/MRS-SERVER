import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { CommandBus } from '@nestjs/cqrs';
import { PatientsService } from './patients.service';
import {
  AddPatientToPharmacyCommand,
  CreatePatientCommand,
  DeletePatientCommand,
  UpdatePatientCommand,
  UpdatePharmacyDeskStateCommand
} from './cqrs/patients.commands';
import { PatientsReplayService } from './projection/patients-replay.service';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'patients', version: '1' })
export class PatientsController {
  constructor(
    private readonly svc: PatientsService,
    private readonly commandBus: CommandBus,
    private readonly replay: PatientsReplayService
  ) {}

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'clinical' as Role, 'recording' as Role)
  @Get()
  async list(@Query('q') q?: string) {
    return this.svc.list(q);
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'recording' as Role, 'staff' as Role)
  @Get('paypoint/referred')
  async listPaypointReferred(@Query('q') q?: string) {
    return this.svc.listPaypointReferred(q);
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'recording' as Role, 'staff' as Role)
  @Get('nhia/referred')
  async listNHIAReferred(@Query('q') q?: string) {
    return this.svc.listNHIAReferred(q);
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'recording' as Role, 'staff' as Role)
  @Get('nhia/stats')
  async nhiaStats(@Query('period') period?: 'daily' | 'monthly' | 'yearly', @Query('value') value?: string) {
    return this.svc.getNHIAStatsByRange({ period, value });
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'recording' as Role, 'staff' as Role, 'pharmacy' as Role)
  @Get('pharmacy/referred')
  async listPharmacyReferred(@Query('q') q?: string) {
    return this.svc.listPharmacyReferred(q);
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'recording' as Role)
  @Post('pharmacy/add')
  async addToPharmacy(@Req() req: any, @Body() body: { patientId: string; prescription?: string; drugs?: any[] }) {
    const meta = { userId: req?.user?.sub as string, roles: (req?.user?.roles || []) as string[] };
    return this.commandBus.execute(
      new AddPatientToPharmacyCommand(body.patientId, { prescription: body.prescription, drugs: body.drugs }, meta)
    );
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'recording' as Role, 'pharmacy' as Role, 'staff' as Role)
  @Patch('pharmacy/:patientId/desk-state')
  async updatePharmacyDeskState(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Body() body: { deskState: string; prescription?: string; drugs?: any[] },
  ) {
    const meta = { userId: req?.user?.sub as string, roles: (req?.user?.roles || []) as string[] };
    return this.commandBus.execute(new UpdatePharmacyDeskStateCommand(patientId, body, meta));
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'recording' as Role)
  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const meta = { userId: req?.user?.sub as string, roles: (req?.user?.roles || []) as string[] };
    return this.commandBus.execute(new CreatePatientCommand(body, meta));
  }

  @Roles(
    'super_admin' as Role,
    'admin' as Role,
    'doctor' as Role,
    'clinical' as Role,
    'recording' as Role,
    'staff' as Role,
    'pharmacy' as Role
  )
  @Get(':id')
  async get(@Param('id') id: string) {
    const doc = await this.svc.findById(id);
    return doc ? doc.toObject() : null;
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'clinical' as Role, 'recording' as Role, 'staff' as Role)
  @Get(':id/nhia/access')
  async nhiaAccess(@Param('id') id: string) {
    return this.svc.getNHIAAccess(id);
  }

  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'clinical' as Role, 'recording' as Role, 'staff' as Role)
  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const meta = { userId: req?.user?.sub as string, roles: (req?.user?.roles || []) as string[] };
    return this.commandBus.execute(new UpdatePatientCommand(id, body, meta));
  }
  @Roles('super_admin' as Role, 'admin' as Role, 'doctor' as Role, 'recording' as Role)
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const meta = { userId: req?.user?.sub as string, roles: (req?.user?.roles || []) as string[] };
    return this.commandBus.execute(new DeletePatientCommand(id, meta));
  }

  @Roles('super_admin' as Role)
  @Post('replay')
  async replayProjection() {
    return this.replay.rebuildFromEvents();
  }
}
