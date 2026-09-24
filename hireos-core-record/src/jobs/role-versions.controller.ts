import { Body, Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import type { RequestMeta } from '../records';
import { RoleVersionsService } from './role-versions.service';

@Controller('jobs/:jobId/role-versions')
@UseGuards(WorkspaceGuard)
export class RoleVersionsController {
  constructor(private readonly roles: RoleVersionsService) {}

  @Get()
  list(@Req() req: { identity: Identity }, @Param('jobId') jobId: string) {
    return this.roles.list(req.identity, jobId);
  }

  @Get(':roleVersionId')
  get(@Req() req: { identity: Identity }, @Param('jobId') jobId: string, @Param('roleVersionId') roleVersionId: string) {
    return this.roles.get(req.identity, jobId, roleVersionId);
  }

  @Post()
  create(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Param('jobId') jobId: string, @Body() body: unknown) {
    return this.roles.createDraft(req.identity, jobId, body, meta(headers));
  }

  @Post(':roleVersionId/confirm')
  confirm(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Param('jobId') jobId: string, @Param('roleVersionId') roleVersionId: string, @Body() body: unknown) {
    return this.roles.confirm(req.identity, jobId, roleVersionId, body, meta(headers));
  }

  @Patch(':roleVersionId')
  update(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Param('jobId') jobId: string, @Param('roleVersionId') roleVersionId: string, @Body() body: unknown) {
    return this.roles.updateDraft(req.identity, jobId, roleVersionId, body, meta(headers));
  }

  @Post(':roleVersionId/snapshots')
  snapshot(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Param('jobId') jobId: string, @Param('roleVersionId') roleVersionId: string, @Body() body: unknown) {
    return this.roles.createSnapshot(req.identity, jobId, roleVersionId, body, meta(headers));
  }
}

function meta(headers: Record<string, string | undefined>): RequestMeta {
  return {
    requestId: headers['x-request-id'],
    correlationId: headers['x-correlation-id'],
    idempotencyKey: headers['idempotency-key'],
  };
}
