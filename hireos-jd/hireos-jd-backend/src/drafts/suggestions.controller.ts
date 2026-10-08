import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { SuggestionsService } from './suggestions.service';

/** Proposed document changes (AI rewrites and Suggesting-mode edits) for one job document. */
@Controller('jobs/:jobId/documents/:audience/suggestions')
@UseGuards(WorkspaceGuard)
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  @Get()
  list(@Req() req: { identity: Identity }, @Param('jobId') jobId: string, @Param('audience') audience: string) {
    return this.suggestions.list(req.identity, jobId, audience);
  }

  @Post()
  create(
    @Req() req: { identity: Identity },
    @Param('jobId') jobId: string,
    @Param('audience') audience: string,
    @Body() body: unknown,
  ) {
    return this.suggestions.create(req.identity, jobId, audience, body);
  }

  @Patch(':id')
  update(
    @Req() req: { identity: Identity },
    @Param('jobId') jobId: string,
    @Param('audience') audience: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.suggestions.update(req.identity, jobId, audience, id, body);
  }
}
