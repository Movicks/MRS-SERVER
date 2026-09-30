import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false
    })
  );
  app.use(compression());
  app.use(mongoSanitize());
  const configService = app.get(ConfigService);
  const corsOriginRaw = configService.get<string>('CORS_ORIGIN');
  const normalize = (o: string) => o.trim().replace(/\/$/, '');
  const origin: boolean | string | string[] =
    corsOriginRaw && corsOriginRaw.includes(',')
      ? corsOriginRaw.split(',').map((o) => normalize(o))
      : corsOriginRaw
      ? normalize(corsOriginRaw)
      : true;
  app.enableCors({ origin, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1'
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  });
  const port = parseInt(process.env.PORT ?? '8000', 10);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MRS API')
    .setDescription('Medical Records System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error({ reason }, 'Unhandled Promise Rejection');
  });
  process.on('uncaughtException', (err: Error) => {
    logger.error({ err }, 'Uncaught Exception');
  });
}

bootstrap();
