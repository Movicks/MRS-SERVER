import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PasswordService } from '../common/security/password';
import { SignupGuard } from './guards/signup.guard';
import { AdminModule } from '../admin/admin.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { DoctorProfileModule } from '../doctor-profile/doctor-profile.module';
import { DutiesModule } from '../duties/duties.module';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    AdminModule,
    InvitationsModule,
    DoctorProfileModule,
    DutiesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET')
      }),
      inject: [ConfigService]
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy, PasswordService, SignupGuard]
})
export class AuthModule {}
