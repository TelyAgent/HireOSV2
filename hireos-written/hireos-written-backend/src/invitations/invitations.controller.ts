import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { CreateInvitationDto } from './create-invitation.dto';
import { InvitationsService } from './invitations.service';

@Controller('cases/:caseId/invitations')
@UseGuards(WorkspaceGuard)
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  create(@Param('caseId') caseId: string, @Body() dto: CreateInvitationDto, @Req() req: { identity: Identity }) {
    return this.invitations.create(req.identity, caseId, dto);
  }

  @Get()
  list(@Param('caseId') caseId: string, @Req() req: { identity: Identity }) {
    return this.invitations.listForCase(req.identity, caseId);
  }
}
