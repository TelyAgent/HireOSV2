import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(WorkspaceGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Req() req: { identity: Identity }) {
    return this.audit.list(req.identity);
  }
}
