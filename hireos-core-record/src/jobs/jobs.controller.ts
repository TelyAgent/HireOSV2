import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { JobsService } from './jobs.service';
import type { RequestMeta } from '../records';

@Controller('jobs')
@UseGuards(WorkspaceGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  create(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Body() body: unknown) {
    return this.jobs.create(req.identity, body, meta(headers));
  }

  @Get()
  list(@Req() req: { identity: Identity }, @Query('q') q?: string) {
    return this.jobs.list(req.identity, q);
  }

  @Get(':id')
  get(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.jobs.get(req.identity, id);
  }

  @Patch(':id')
  patch(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Param('id') id: string, @Body() body: unknown) {
    return this.jobs.patch(req.identity, id, body, meta(headers));
  }

  @Get(':id/history')
  history(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.jobs.history(req.identity, id);
  }

  @Delete(':id')
  delete(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Param('id') id: string) {
    return this.jobs.delete(req.identity, id, meta(headers));
  }
}

function meta(headers: Record<string, string | undefined>): RequestMeta {
  return {
    requestId: headers['x-request-id'],
    correlationId: headers['x-correlation-id'],
    idempotencyKey: headers['idempotency-key'],
  };
}
