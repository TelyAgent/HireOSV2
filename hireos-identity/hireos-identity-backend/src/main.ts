import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const host = config.get<string>('HOST', '127.0.0.1');
  const port = config.get<number>('PORT', 3003);
  await app.listen(port, host);
  Logger.log(`Identity backend listening on http://${host}:${port}/api`, 'Bootstrap');
}

void bootstrap();
