import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { DocRewriteService } from './doc-rewrite.service';

/** AI rewrite of a selected part of the job workspace document, and free questions (Copilot side panel). */
@Controller('jobs/:jobId/documents/:audience')
@UseGuards(WorkspaceGuard)
export class DocRewriteController {
  constructor(private readonly rewrite: DocRewriteService) {}

  @Post('rewrite')
  create(
    @Req() req: { identity: Identity },
    @Param('jobId') jobId: string,
    @Param('audience') audience: string,
    @Body() body: unknown,
  ) {
    return this.rewrite.rewrite(req.identity, jobId, audience, body);
  }

  /** A typed message: answered, researched, refused as out of scope, or turned into a proposal (#106 #107). */
  @Post('ask')
  ask(
    @Req() req: { identity: Identity },
    @Param('jobId') jobId: string,
    @Param('audience') audience: string,
    @Body() body: unknown,
  ) {
    return this.rewrite.ask(req.identity, jobId, audience, body);
  }
}
