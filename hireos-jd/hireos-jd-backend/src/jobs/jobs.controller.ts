import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { CoreRecordClient } from '../core/core-record.client';

/**
 * Thin passthrough to Core Record's job directory — no composition with the JD backend's own
 * `JobDraft`/approval data yet (Core Record's Job model only has title/team/location/employmentType/
 * openings/status/version). The frontend fills in the richer JD-Library-specific fields (department,
 * hiring manager, approval state, active role version, ...) with sensible defaults where this response
 * doesn't have them.
 */
@Controller('jobs')
@UseGuards(WorkspaceGuard)
export class JobsController {
  constructor(private readonly coreRecord: CoreRecordClient) {}

  @Get()
  list(@Req() req: { identity: Identity }, @Query('q') q?: string) {
    return this.coreRecord.listJobs(req.identity, q);
  }

  @Get(':id')
  get(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.coreRecord.getJob(req.identity, id);
  }

  /**
   * This app's two-state hiring status mapped onto Core Record's job status: "published" → `open`,
   * "draft" → `draft` (see `coreJobToLocalJob` in the frontend for the reverse mapping).
   */
  @Patch(':id/status')
  updateStatus(
    @Req() req: { identity: Identity },
    @Headers() headers: Record<string, string | undefined>,
    @Param('id') id: string,
    @Body() body: { status?: unknown },
  ) {
    const idempotencyKey = headers['idempotency-key']?.trim();
    if (!idempotencyKey) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    if (body?.status !== 'published' && body?.status !== 'draft') {
      throw new BadRequestException({ code: 'INVALID_STATUS', message: 'status must be "published" or "draft".' });
    }
    const coreStatus = body.status === 'published' ? 'open' : 'draft';
    return this.coreRecord.updateJob(
      req.identity,
      id,
      { status: coreStatus, reason: body.status === 'published' ? 'published' : 'unpublished' },
      idempotencyKey,
    );
  }

  @Delete(':id')
  delete(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Param('id') id: string) {
    const idempotencyKey = headers['idempotency-key']?.trim();
    if (!idempotencyKey) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    return this.coreRecord.deleteJob(req.identity, id, idempotencyKey);
  }
}
