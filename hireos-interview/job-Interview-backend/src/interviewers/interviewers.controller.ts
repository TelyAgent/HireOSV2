import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../intake/workspace.guard';
import { InterviewersService } from './interviewers.service';

@Controller()
@UseGuards(WorkspaceGuard)
export class InterviewersController {
  constructor(private readonly interviewers: InterviewersService) {}
  @Get('interviewers/account-bindings')
  bindings(@Req() req: { identity: Identity }) { return this.interviewers.bindings(req.identity); }
  @Post('interviewers/:id/account-binding')
  bind(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) {
    return this.interviewers.bind(req.identity, id, body);
  }
  @Get('interviewers')
  list(@Req() req: { identity: Identity }) {
    return this.interviewers.list(req.identity.workspaceId);
  }
}
