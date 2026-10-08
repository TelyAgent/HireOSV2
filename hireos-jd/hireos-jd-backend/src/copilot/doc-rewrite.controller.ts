import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { DocRewriteService } from './doc-rewrite.service';

/** AI rewrite of a selected part of the job workspace document (Copilot side panel). */
@Controller('jobs/:jobId/documents/:audience/rewrite')
@UseGuards(WorkspaceGuard)
export class DocRewriteController {
  constructor(private readonly rewrite: DocRewriteService) {}

  @Post()
  create(
    @Req() req: { identity: Identity },
    @Param('jobId') jobId: string,
    @Param('audience') audience: string,
    @Body() body: unknown,
  ) {
    return this.rewrite.rewrite(req.identity, jobId, audience, body);
  }
}
