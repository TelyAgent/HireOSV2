import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { FinalizeEvaluationDto, ReleaseResultDto } from './case-result.dto';
import { InvitationsService } from './invitations.service';

/** Review outcome of a case's latest submission -- finalize the scoring, then publish the result. */
@Controller('cases/:caseId/result')
@UseGuards(WorkspaceGuard)
export class CaseResultController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('finalize')
  finalize(@Param('caseId') caseId: string, @Body() dto: FinalizeEvaluationDto, @Req() req: { identity: Identity }) {
    return this.invitations.finalizeEvaluation(req.identity, caseId, dto);
  }

  @Post('release')
  release(@Param('caseId') caseId: string, @Body() dto: ReleaseResultDto, @Req() req: { identity: Identity }) {
    return this.invitations.releaseResult(req.identity, caseId, dto);
  }
}
