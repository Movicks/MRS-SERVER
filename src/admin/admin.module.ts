import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PasswordService } from '../common/security/password';

@Module({
  controllers: [AdminController],
  providers: [AdminService, PasswordService],
  exports: [AdminService]
})
export class AdminModule {}
