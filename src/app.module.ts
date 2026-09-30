import { Module } from '@nestjs/common';
import * as Joi from 'joi';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { InvitationsModule } from './invitations/invitations.module';
import { DoctorProfileModule } from './doctor-profile/doctor-profile.module';
import { MailerModule } from './mailer/mailer.module';
import { RealtimeModule } from './realtime/realtime.module';
import { PatientsModule } from './patients/patients.module';
import { GopdModule } from './gopd/gopd.module';
import { DepartmentsModule } from './departments/departments.module';
import { DutiesModule } from './duties/duties.module';
import { NursesModule } from './nurses/nurses.module';
import { DoctorsModule } from './doctors/doctors.module';
import { LabReferralsModule } from './lab-referrals/lab-referrals.module';
import { XrayReferralsModule } from './xray-referrals/xray-referrals.module';
import { StaffModule } from './staff/staff.module';
import { PriceListModule } from './price-list/price-list.module';
import { InvoicesModule } from './invoices/invoices.module';
import { HealthModule } from './health/health.module';
import { EventsModule } from './events/events.module';
import { ClinicalModule } from './clinical/clinical.module';
import { WardsModule } from './wards/wards.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(8000),
        CORS_ORIGIN: Joi.string().optional(),
        DATABASE_URL: Joi.string().required(),
        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        PEPPER_SECRET: Joi.string().required(),
        RATE_LIMIT_TTL: Joi.number().default(60),
        RATE_LIMIT_LIMIT: Joi.number().default(100),
        MAIL_FROM: Joi.string().optional(),
        APP_NAME: Joi.string().optional(),
        FRONTEND_URL: Joi.string().optional(),
        PUBLIC_API_URL: Joi.string().optional(),
        PUBLIC_APP_URL: Joi.string().optional(),
        RESEND_API_KEY: Joi.string().optional(),
        USE_ETHEREAL_FALLBACK: Joi.boolean().default(false)
      })
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'silent',
        autoLogging: false
      }
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        throttlers: [
          {
            ttl: (config.get<number>('RATE_LIMIT_TTL') ?? 60) * 1000,
            limit: config.get<number>('RATE_LIMIT_LIMIT') ?? 100
          }
        ]
      }),
      inject: [ConfigService]
    }),
    PrismaModule,
    UsersModule,
    AdminModule,
    AuthModule,
    ProfileModule,
    MailerModule,
    RealtimeModule,
    InvitationsModule,
    DoctorProfileModule,
    PatientsModule,
    GopdModule,
    DepartmentsModule,
    DutiesModule,
    NursesModule,
    DoctorsModule,
    LabReferralsModule,
    XrayReferralsModule,
    StaffModule,
    PriceListModule,
    InvoicesModule,
    WardsModule,
    ClinicalModule,
    HealthModule,
    EventsModule
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
