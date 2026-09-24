import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { OutboxService } from './outbox.service';

@Controller('outbox')
@UseGuards(WorkspaceGuard)
export class OutboxController {
  constructor(private readonly outbox: OutboxService) {}

  @Get()
  list(@Req() req: { identity: Identity }) {
    return this.outbox.list(req.identity);
  }
}
