import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { RtmsService } from './meetings/rtms.service';

const RTMS_WEBHOOK_PATH = '/api/meetings/webhooks/zoom';
const zoomWebhookLogger = new Logger('ZoomWebhook');

async function readZoomWebhookBody(req: any): Promise<Record<string, any>> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return { __invalidJson: true };
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { __invalidJson: true };
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '1mb' });

  // Mounted directly on the underlying Express instance (bypassing WorkspaceGuard and
  // Nest's controller layer): Zoom calls this with no session of ours to authenticate —
  // it proves itself via the signature checked inside, not via our normal auth.
  const rtmsService = app.get(RtmsService);
  app.getHttpAdapter().getInstance().post(RTMS_WEBHOOK_PATH, async (req: any, res: any) => {
    // Durable local record of every Zoom call that reaches us. The ngrok inspector rotates its
    // history and the app's own logger is off by default, so without this line "Zoom never called
    // us" and "Zoom called and we mishandled it" are indistinguishable after the fact.
    zoomWebhookLogger.log(`ingress method=${String(req.method ?? 'POST')} url=${String(req.originalUrl ?? req.url ?? RTMS_WEBHOOK_PATH)} ua=${String(req.headers['user-agent'] ?? '-')}`);
    const body = await readZoomWebhookBody(req);
    if (body.__invalidJson) {
      zoomWebhookLogger.warn('invalid JSON body');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    zoomWebhookLogger.log(`received event=${body?.event ?? 'unknown'} signature=${String(req.headers['x-zm-signature'] ?? '-')}`);
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
  });
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
