import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { CLOSE_REASONS, CaseLifecycleService, type CloseReason } from './case-lifecycle.service';

class CloseCaseDto {
  @IsIn(CLOSE_REASONS)
  reason!: CloseReason;
}

/** HR's post-result actions on a case: hold / resume, end testing, hand off to interview. */
@Controller('cases/:caseId')
@UseGuards(WorkspaceGuard)
export class CasesController {
  constructor(private readonly lifecycle: CaseLifecycleService) {}

  @Post('hold')
  hold(@Param('caseId') caseId: string, @Req() req: { identity: Identity }) {
    return this.lifecycle.hold(req.identity, caseId);
  }

  @Post('resume')
  resume(@Param('caseId') caseId: string, @Req() req: { identity: Identity }) {
    return this.lifecycle.resume(req.identity, caseId);
  }

  @Post('close')
  close(@Param('caseId') caseId: string, @Body() dto: CloseCaseDto, @Req() req: { identity: Identity }) {
    return this.lifecycle.close(req.identity, caseId, dto.reason);
  }

  @Post('interview-handoff')
  handoff(@Param('caseId') caseId: string, @Req() req: { identity: Identity }) {
    return this.lifecycle.handoffToInterview(req.identity, caseId);
  }
}
