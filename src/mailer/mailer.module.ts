import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppMailerService } from './app-mailer.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AppMailerService],
  exports: [AppMailerService]
})
export class MailerModule {}
