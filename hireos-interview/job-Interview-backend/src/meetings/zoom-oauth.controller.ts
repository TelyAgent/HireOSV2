import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ZoomHostService } from './zoom-host.service';

// Confidential OAuth uses the public ngrok HTTPS URL, so the callback must be handled
// by the main backend process rather than the temporary loopback listener.
@Controller('integrations/zoom')
export class ZoomOAuthController {
  constructor(private readonly zoom: ZoomHostService) {}

  @Get('callback')
  async callback(@Query() query: Record<string, string>, @Res() response: Response) {
    const url = new URL('/api/integrations/zoom/callback', 'https://oauth.local');
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const result = await this.zoom.handleOAuthCallback(url);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    return response.status(result.status).type('text/plain').send(result.message);
  }
}
