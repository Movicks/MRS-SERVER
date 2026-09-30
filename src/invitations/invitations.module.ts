import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { MailerModule } from '../mailer/mailer.module';
import { UsersModule } from '../users/users.module';
import { DoctorProfileModule } from '../doctor-profile/doctor-profile.module';

@Module({
  imports: [MailerModule, UsersModule, DoctorProfileModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
