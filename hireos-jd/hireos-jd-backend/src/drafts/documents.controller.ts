import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { DocumentsService } from './documents.service';

@Controller('jobs/:jobId/documents')
@UseGuards(WorkspaceGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get(':audience')
  get(@Req() req: { identity: Identity }, @Param('jobId') jobId: string, @Param('audience') audience: string) {
    return this.documents.get(req.identity, jobId, audience);
  }

  @Put(':audience')
  save(@Req() req: { identity: Identity }, @Param('jobId') jobId: string, @Param('audience') audience: string, @Body() body: unknown) {
    return this.documents.save(req.identity, jobId, audience, body);
  }
}
