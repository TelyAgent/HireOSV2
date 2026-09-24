import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { SubmitAnswersDto } from './submit-answers.dto';

// Deliberately outside WorkspaceGuard -- this is the candidate-facing side of the flow, reached
// from an emailed link, not an authenticated HR session. The unguessable `token` in the URL *is*
// the access control (matches how the "sent" invitation link itself works in the real prototype).
@Controller('public/invitations')
export class PublicInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.invitations.getPublic(token);
  }

  @Post(':token/submit')
  submit(@Param('token') token: string, @Body() dto: SubmitAnswersDto) {
    return this.invitations.submit(token, dto);
  }
}
