import { Body, Controller, Get, Post, Query, UseGuards, Req } from '@nestjs/common';
import { Param, Patch, Delete, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { CommandBus } from '@nestjs/cqrs';
import { DutiesService } from './duties.service';
import { Shift, DutyStatus } from './duty.schema';
import { CreateDutyCommand, DeleteDutyCommand, UpdateDutyCommand } from './cqrs/duties.commands';
import { DutiesReplayService } from './projection/duties-replay.service';

@ApiTags('duties')
@Controller({ path: 'duties', version: '1' })
export class DutiesController {
  constructor(
    private readonly svc: DutiesService,
    private readonly commandBus: CommandBus,
    private readonly replay: DutiesReplayService
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role, 'recording' as Role)
  @Post()
  async create(
    @Req() req: any,
    @Body() body: { role: 'doctor' | 'staff' | 'recording' | 'radiology'; staffId?: string; staffIds?: string[]; departmentId: string; date: string; shift: Shift; timeIn: string; timeOut: string; status: DutyStatus; assignedBy: string; }
  ) {
    const meta = { userId: req?.user?.sub as string, roles: (req?.user?.roles || []) as string[] };
    return this.commandBus.execute(new CreateDutyCommand(body, meta));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Query() query: { role?: 'doctor' | 'staff' | 'recording' | 'radiology'; departmentId?: string; date?: string; shift?: Shift }) {
    return this.svc.list(query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role, 'recording' as Role, 'staff' as Role, 'doctor' as Role, 'radiology' as Role)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Partial<{ departmentId: string; date: string; shift: Shift; timeIn: string; timeOut: string; status: DutyStatus }>, @Req() req: any) {
    const duty = await this.svc.getById(id);
    if (!duty) throw new ForbiddenException('Duty not found');
    const roles: string[] = (req.user?.roles || []) as string[];
    const userId: string = req.user?.sub;
    if (roles.includes('staff') && String(duty.nurseUserId) !== String(userId)) {
      throw new ForbiddenException('Cannot edit other staff duty');
    }
    if (roles.includes('doctor') && String(duty.doctorUserId) !== String(userId)) {
      throw new ForbiddenException('Cannot edit other doctor duty');
    }
    if (roles.includes('recording') && String(duty.recordingUserId) !== String(userId)) {
      throw new ForbiddenException('Cannot edit other recording staff duty');
    }
    if (roles.includes('radiology') && String((duty as any).radiologyUserId) !== String(userId)) {
      throw new ForbiddenException('Cannot edit other radiology duty');
    }
    const meta = { userId, roles };
    return this.commandBus.execute(new UpdateDutyCommand(id, body, meta));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role, 'admin' as Role, 'recording' as Role, 'staff' as Role, 'doctor' as Role, 'radiology' as Role)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const duty = await this.svc.getById(id);
    if (!duty) throw new ForbiddenException('Duty not found');
    const roles: string[] = (req.user?.roles || []) as string[];
    const userId: string = req.user?.sub;
    if (roles.includes('staff') && String(duty.nurseUserId) !== String(userId)) {
      throw new ForbiddenException('Cannot delete other staff duty');
    }
    if (roles.includes('doctor') && String(duty.doctorUserId) !== String(userId)) {
      throw new ForbiddenException('Cannot delete other doctor duty');
    }
    if (roles.includes('recording') && String(duty.recordingUserId) !== String(userId)) {
      throw new ForbiddenException('Cannot delete other recording staff duty');
    }
    if (roles.includes('radiology') && String((duty as any).radiologyUserId) !== String(userId)) {
      throw new ForbiddenException('Cannot delete other radiology duty');
    }
    const meta = { userId, roles };
    return this.commandBus.execute(new DeleteDutyCommand(id, meta));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin' as Role)
  @Post('replay')
  async replayProjection() {
    return this.replay.rebuildFromEvents();
  }
}
