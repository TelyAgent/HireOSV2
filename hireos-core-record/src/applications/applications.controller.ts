import { Body, Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { ApplicationsService } from './applications.service';
import type { RequestMeta } from '../records';

@Controller('applications')
@UseGuards(WorkspaceGuard)
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  create(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Body() body: unknown) {
    return this.applications.create(req.identity, body, meta(headers));
  }

  @Get(':id')
  get(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.applications.get(req.identity, id);
  }

  @Patch(':id')
  patch(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Param('id') id: string, @Body() body: unknown) {
    return this.applications.patch(req.identity, id, body, meta(headers));
  }

  @Post(':id/status')
  status(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Param('id') id: string, @Body() body: unknown) {
    return this.applications.patch(req.identity, id, body, meta(headers));
  }

  @Get(':id/history')
  history(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.applications.history(req.identity, id);
  }
}

function meta(headers: Record<string, string | undefined>): RequestMeta {
  return {
    requestId: headers['x-request-id'],
    correlationId: headers['x-correlation-id'],
    idempotencyKey: headers['idempotency-key'],
  };
}
