import { BadRequestException, Body, Controller, Get, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from '../admin/admin.service';
import { UsersService } from '../users/users.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import type { Request } from 'express';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DoctorProfileService } from '../doctor-profile/doctor-profile.service';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'profile', version: '1' })
export class ProfileController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
    private readonly doctorProfileService: DoctorProfileService
  ) {}

  @Get('me')
  async me(@Req() req: { user: { userId: string } }) {
    const id = req.user.userId;
    const admin = await this.adminService.findById(id);
    if (admin) {
      const obj = admin.toObject();
      return {
        id: String(obj._id),
        email: obj.email,
        name: obj.name,
        imageUrl: obj.imageUrl,
        phone: obj.phone,
        address: obj.address,
        country: obj.country,
        state: obj.state,
        emergencyPhone: obj.emergencyPhone,
        roles: obj.roles,
      };
    }
    const user = await this.usersService.findById(id);
    if (user) {
      const obj = user.toObject();
      return {
        id: String(obj._id),
        email: obj.email,
        name: obj.name,
        imageUrl: obj.imageUrl,
        phone: obj.phone,
        address: obj.address,
        country: obj.country,
        state: obj.state,
        emergencyPhone: obj.emergencyPhone,
        roles: obj.roles,
      };
    }
    try {
      const profile = await this.doctorProfileService.findByUserId(id);
      return {
        id,
        name: profile.personalInfo.fullName,
        email: profile.personalInfo.email,
        imageUrl: profile.personalInfo.imageUrl,
        phone: profile.personalInfo.phone,
        address: profile.personalInfo.address,
        country: profile.personalInfo.nationality,
        state: profile.personalInfo.state || '',
        emergencyPhone: profile.personalInfo.emergencyContact,
        roles: ['doctor'],
      };
    } catch {
      return null;
    }
  }

  @Patch('me')
  async updateMe(@Req() req: { user: { userId: string } }, @Body() dto: UpdateUserDto) {
    const id = req.user.userId;
    const admin = await this.adminService.findById(id);
    if (admin) {
      const updated = await this.adminService.update(id, dto);
      const obj = updated.toObject();
      delete (obj as any).passwordHash;
      delete (obj as any).refreshTokenHash;
      return obj;
    }
    const user = await this.usersService.findById(id);
    if (user) {
      const updated = await this.usersService.update(id, dto);
      const obj = updated.toObject();
      delete (obj as any).passwordHash;
      delete (obj as any).refreshTokenHash;
      return obj;
    }
    // Fallback to doctor profile update
    const patch: any = {};
    if (dto.name !== undefined) patch['personalInfo.fullName'] = dto.name;
    if (dto.email !== undefined) patch['personalInfo.email'] = dto.email?.toLowerCase();
    if (dto.imageUrl !== undefined) patch['personalInfo.imageUrl'] = dto.imageUrl;
    if (dto.phone !== undefined) patch['personalInfo.phone'] = dto.phone;
    if (dto.address !== undefined) patch['personalInfo.address'] = dto.address;
    if (dto.country !== undefined) patch['personalInfo.nationality'] = dto.country;
    if (dto.state !== undefined) patch['personalInfo.state'] = dto.state; 
    if (dto.emergencyPhone !== undefined) patch['personalInfo.emergencyContact'] = dto.emergencyPhone;
    
    const profile = await this.doctorProfileService.updateForUser(id, patch);
    return {
      name: profile.personalInfo.fullName,
      email: profile.personalInfo.email,
      imageUrl: profile.personalInfo.imageUrl,
      phone: profile.personalInfo.phone,
      address: profile.personalInfo.address,
      country: profile.personalInfo.nationality,
      state: profile.personalInfo.state || '',
      emergencyPhone: profile.personalInfo.emergencyContact
    };
  }

  @Patch('me/password')
  async changePassword(@Req() req: { user: { userId: string } }, @Body() dto: ChangePasswordDto) {
    const id = req.user.userId;
    const admin = await this.adminService.findById(id);
    if (admin) await this.adminService.changePassword(id, dto.currentPassword, dto.newPassword);
    else {
      const user = await this.usersService.findById(id);
      if (user) await this.usersService.changePassword(id, dto.currentPassword, dto.newPassword);
      else await this.doctorProfileService.changePassword(id, dto.currentPassword, dto.newPassword);
    }
    return { ok: true };
  }

  @Post('me/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
          const dir = join(process.cwd(), 'uploads', 'avatars');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req: Request & { user?: { userId: string } }, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
          const id = req.user?.userId || 'user';
          const unique = Date.now();
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${id}-${unique}${ext}`);
        }
      }),
      fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | BadRequestException | null, acceptFile: boolean) => void) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new BadRequestException('Invalid file type'), false);
      },
      limits: { fileSize: 5 * 1024 * 1024 }
    })
  )
  async uploadImage(@Req() req: Request & { user: { userId: string } }, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const id = req.user.userId;
    const base = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${base}/uploads/avatars/${file.filename}`;
    const admin = await this.adminService.findById(id);
    if (admin) {
      await this.adminService.update(id, { imageUrl });
      return { imageUrl };
    }
    const user = await this.usersService.findById(id);
    if (user) {
      await this.usersService.update(id, { imageUrl });
      return { imageUrl };
    }
    await this.doctorProfileService.updateForUser(id, { 'personalInfo.imageUrl': imageUrl });
    return { imageUrl };
  }
}
