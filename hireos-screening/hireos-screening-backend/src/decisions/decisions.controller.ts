import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { DecisionsService } from './decisions.service';

@Controller()
@UseGuards(WorkspaceGuard)
export class DecisionsController {
  constructor(private readonly decisions: DecisionsService) {}

  @Post('applications/:id/decisions')
  record(
    @Req() req: { identity: Identity },
    @Param('id') id: string,
    @Body() body: {
      outcome?: string;
      reason?: string;
      nextStepTarget?: string;
      overrideAi?: boolean;
      exceptionApproved?: boolean;
    },
  ) {
    return this.decisions.record(req.identity, id, body);
  }

  @Post('applications/:id/decisions/:decisionId/withdraw')
  withdraw(@Req() req: { identity: Identity }, @Param('id') id: string, @Param('decisionId') decisionId: string, @Body() body: { reason?: string }) {
    return this.decisions.withdraw(req.identity, id, decisionId, body);
  }

  @Post('applications/:id/decline-notice')
  declineNotice(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.decisions.sendDeclineNotice(req.identity, id);
  }

  @Post('applications/:id/assessment/complete')
  completeAssessment(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.decisions.completeAssessment(req.identity, id);
  }
}
