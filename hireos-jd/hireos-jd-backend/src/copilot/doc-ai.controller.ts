import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { DocAiService } from './doc-ai.service';

/** Completeness-standard AI for a job document: draft / fix a section, and the AI analysis. */
@Controller('jobs/:jobId/documents/:audience/ai')
@UseGuards(WorkspaceGuard)
export class DocAiController {
  constructor(private readonly ai: DocAiService) {}

  @Post('section')
  section(@Req() req: { identity: Identity }, @Param('jobId') jobId: string, @Body() body: unknown) {
    return this.ai.section(req.identity, jobId, body);
  }

  @Post('analyze')
  analyze(@Req() req: { identity: Identity }, @Param('jobId') jobId: string, @Body() body: unknown) {
    return this.ai.analyze(req.identity, jobId, body);
  }
}
