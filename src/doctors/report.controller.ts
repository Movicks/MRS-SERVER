import { Body, Controller, Get, Post, Put, Delete, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Role } from '../common/types/roles';
import { ReportService } from './report.service';

@ApiTags('doctors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'doctors/reports', version: '1' })
export class ReportController {
  constructor(private readonly svc: ReportService) {}

  @Roles('doctor' as Role, 'staff' as Role, 'super_admin' as Role, 'admin' as Role)
  @Post()
  async add(
    @Req() req: any,
    @Body()
    body: {
      patientId: string;
      text?: string;
      clinicalNote?: string;
      diagnosis?: string;
      imageUrl?: string;
      replyToId?: string;
      senderName?: string;
    },
  ) {
    const senderId = req?.user?.sub as string;
    return this.svc.add({
      patientId: body.patientId,
      senderId,
      text: body.text,
      clinicalNote: body.clinicalNote,
      diagnosis: body.diagnosis,
      imageUrl: body.imageUrl,
      replyToId: body.replyToId,
      senderName: body.senderName,
    });
  }

  @Roles('doctor' as Role, 'clinical' as Role, 'staff' as Role, 'super_admin' as Role, 'admin' as Role, 'recording' as Role)
  @Get()
  async list(@Query('patientId') patientId: string) {
    return this.svc.list(patientId);
  }

  @Roles('doctor' as Role, 'staff' as Role, 'super_admin' as Role, 'admin' as Role)
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { text?: string; clinicalNote?: string; diagnosis?: string; imageUrl?: string }) {
    return this.svc.update(id, {
      text: body.text,
      clinicalNote: body.clinicalNote,
      diagnosis: body.diagnosis,
      imageUrl: body.imageUrl,
    });
  }

  @Roles('doctor' as Role, 'staff' as Role, 'super_admin' as Role, 'admin' as Role)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
