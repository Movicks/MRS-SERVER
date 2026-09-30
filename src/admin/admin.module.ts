import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PasswordService } from '../common/security/password';
import { SignupGuard } from '../auth/guards/signup.guard';

@Module({
  imports: [JwtModule],
  controllers: [AdminController],
  providers: [AdminService, PasswordService, SignupGuard],
  exports: [AdminService]
})
export class AdminModule {}
