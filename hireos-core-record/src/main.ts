import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ZodExceptionFilter } from './http/zod-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const corsOrigin = config.get<string>('CORS_ORIGIN');

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean)
      : true,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ZodExceptionFilter());
  app.enableShutdownHooks();

  const host = config.get<string>('HOST', '127.0.0.1');
  const port = config.get<number>('PORT', 3004);
  await app.listen(port, host);
  Logger.log(`Core Record Service listening on http://${host}:${port}/api/v1`, 'Bootstrap');
}

void bootstrap();
