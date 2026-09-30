import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { StaffController } from './staff.controller';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [StaffController],
})
export class StaffModule {}

