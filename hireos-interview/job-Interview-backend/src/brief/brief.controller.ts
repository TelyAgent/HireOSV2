import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { BriefService } from './brief.service';
import { WorkspaceGuard, type Identity } from '../intake/workspace.guard';

@Controller()
@UseGuards(WorkspaceGuard)
export class BriefController {
  constructor(private readonly brief: BriefService) {}

  @Post('jobs/:id/rubric-questions')
  generatePreview(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.brief.rubricPreview(req.identity.workspaceId, id, true);
  }

  @Get('jobs/:id/rubric-questions')
  getPreview(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.brief.rubricPreview(req.identity.workspaceId, id);
  }

  @Post('jobs/:id/brief-questions')
  generate(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.brief.generate(req.identity.workspaceId, id);
  }

  @Get('jobs/:id/brief-questions')
  getQuestions(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.brief.getQuestions(req.identity.workspaceId, id);
  }
}
