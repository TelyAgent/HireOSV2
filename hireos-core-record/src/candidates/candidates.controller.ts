import { Body, Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { CandidatesService } from './candidates.service';
import type { RequestMeta } from '../records';

@Controller('candidates')
@UseGuards(WorkspaceGuard)
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @Post()
  create(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Body() body: unknown) {
    return this.candidates.create(req.identity, body, meta(headers));
  }

  @Get(':id')
  get(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.candidates.get(req.identity, id);
  }

  @Patch(':id')
  patch(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Param('id') id: string, @Body() body: unknown) {
    return this.candidates.patch(req.identity, id, body, meta(headers));
  }

  @Get(':id/history')
  history(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.candidates.history(req.identity, id);
  }
}

function meta(headers: Record<string, string | undefined>): RequestMeta {
  return {
    requestId: headers['x-request-id'],
    correlationId: headers['x-correlation-id'],
    idempotencyKey: headers['idempotency-key'],
  };
}
