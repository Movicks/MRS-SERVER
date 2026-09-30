import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersRolesMaintenanceController } from './users_roles_maintenance.controller';
import { PasswordService } from '../common/security/password';
import { DoctorProfileModule } from '../doctor-profile/doctor-profile.module';

@Module({
  imports: [forwardRef(() => DoctorProfileModule)],
  controllers: [UsersController, UsersRolesMaintenanceController],
  providers: [UsersService, PasswordService],
  exports: [UsersService],
})
export class UsersModule {}
