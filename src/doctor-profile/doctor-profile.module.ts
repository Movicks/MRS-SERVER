import { Module, forwardRef } from '@nestjs/common';
import { DoctorProfileService } from './doctor-profile.service';
import { DoctorProfileController } from './doctor-profile.controller';
import { PasswordService } from '../common/security/password';
import { RealtimeModule } from '../realtime/realtime.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [RealtimeModule, forwardRef(() => UsersModule)],
  controllers: [DoctorProfileController],
  providers: [DoctorProfileService, PasswordService],
  exports: [DoctorProfileService]
})
export class DoctorProfileModule {}
