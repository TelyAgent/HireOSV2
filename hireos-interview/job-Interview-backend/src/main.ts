import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import rtms from '@zoom/rtms';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { RtmsService } from './meetings/rtms.service';

const RTMS_WEBHOOK_PATH = '/api/meetings/webhooks/zoom';
const zoomWebhookLogger = new Logger('ZoomWebhook');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '1mb' });

  // Mounted directly on the underlying Express instance (bypassing WorkspaceGuard and
  // Nest's controller layer): Zoom calls this with no session of ours to authenticate —
  // it proves itself via the signature checked inside, not via our normal auth.
  const rtmsService = app.get(RtmsService);
  app.getHttpAdapter().getInstance().post(RTMS_WEBHOOK_PATH, rtms.createWebhookHandler((body: any, req, res) => {
    // Durable local record of every Zoom call that reaches us. The ngrok inspector rotates its
    // history and the app's own logger is off by default, so without this line "Zoom never called
    // us" and "Zoom called and we mishandled it" are indistinguishable after the fact.
    zoomWebhookLogger.log(`received event=${body?.event ?? 'unknown'} ua=${String(req.headers['user-agent'] ?? '-')}`);
    if (body?.event === 'endpoint.url_validation') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rtmsService.urlValidationResponse(body.payload?.plainToken)));
      return;
    }
    if (!rtmsService.verifySignature(body, req.headers['x-zm-request-timestamp'] as string, req.headers['x-zm-signature'] as string)) {
      res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    void rtmsService.handleEvent(body);
  }, RTMS_WEBHOOK_PATH));
  const config = app.get(ConfigService);
  const corsOrigin = config.get<string>('CORS_ORIGIN');
  const port = config.get<number>('PORT', 3000);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean)
      : true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableShutdownHooks();
  await app.listen(port, config.get<string>('HOST', '127.0.0.1'));
}

void bootstrap();
