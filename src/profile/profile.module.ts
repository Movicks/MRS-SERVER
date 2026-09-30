import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { AdminModule } from '../admin/admin.module';
import { UsersModule } from '../users/users.module';
import { DoctorProfileModule } from '../doctor-profile/doctor-profile.module';

@Module({
  imports: [AdminModule, UsersModule, DoctorProfileModule],
  controllers: [ProfileController]
})
export class ProfileModule {}
