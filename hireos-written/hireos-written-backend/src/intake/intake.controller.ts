import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { ScreeningHandoffDto } from './screening-handoff.dto';
import { ScreeningHandoffService } from './screening-handoff.service';

@Controller('intake')
@UseGuards(WorkspaceGuard)
export class IntakeController {
  constructor(private readonly screeningHandoff: ScreeningHandoffService) {}

  @Post('screening-handoff')
  ingestScreeningHandoff(@Req() req: { identity: Identity }, @Body() body: ScreeningHandoffDto) {
    return this.screeningHandoff.ingest(req.identity, body);
  }
}
