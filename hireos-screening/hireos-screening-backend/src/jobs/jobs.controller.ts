import { Body, Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(WorkspaceGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@Req() req: { identity: Identity }) {
    return this.jobs.list(req.identity);
  }

  /** "New job", step one: the model reads the JD and suggests title, team and location; nothing is created (#178). */
  @Post('quick-start/preview')
  quickStartPreview(@Req() req: { identity: Identity }, @Body() body: unknown) {
    return this.jobs.quickStartPreview(req.identity, body);
  }

  /** "New job": pasted JD text -> a draft job in JD + Core Record that Screening uses right away. */
  @Post('quick-start')
  quickStart(@Req() req: { identity: Identity }, @Headers('idempotency-key') key: string | undefined, @Body() body: unknown) {
    return this.jobs.quickStart(req.identity, body, key);
  }

  @Get(':id')
  get(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.jobs.get(req.identity, id);
  }

  @Patch(':id/criteria')
  updateCriteria(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) {
    return this.jobs.updateCriteria(req.identity, id, body);
  }

  @Post(':id/criteria/confirm')
  confirmCriteria(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.jobs.confirmCriteria(req.identity, id, req.identity.actorId);
  }

  @Post(':id/criteria/reopen')
  reopenCriteria(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.jobs.reopenCriteria(req.identity, id);
  }
}
