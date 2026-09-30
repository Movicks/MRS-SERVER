import { Module, forwardRef } from '@nestjs/common';
import { NursesController } from './nurses.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [NursesController],
})
export class NursesModule {}
