import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, StreamableFile } from '@nestjs/common';
import { RubricExportService } from './rubric-export.service';
import { RubricService } from './rubric.service';
import { WorkspaceGuard, type Identity } from '../intake/workspace.guard';

@Controller()
@UseGuards(WorkspaceGuard)
export class RubricController {
  constructor(private readonly rubric: RubricService, private readonly exports: RubricExportService) {}

  @Post('jobs/:id/rubric/exports')
  exportRubric(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) {
    return this.exports.create(req.identity, id, body);
  }

  @Get('jobs/:id/rubric/exports')
  exportHistory(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.exports.list(req.identity.workspaceId, id);
  }

  @Get('jobs/:id/rubric/exports/:exportId/pdf')
  async exportPdf(@Req() req: { identity: Identity }, @Param('id') id: string, @Param('exportId') exportId: string) {
    return new StreamableFile(await this.exports.download(req.identity.workspaceId, id, exportId), { type: 'application/pdf', disposition: 'attachment; filename="rubric.pdf"' });
  }

  @Get('tasks/:id/rubric-claims')
  claims(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.rubric.candidateClaims(req.identity.workspaceId, id);
  }

  @Post('tasks/:id/rubric-claims')
  generateClaims(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.rubric.candidateClaims(req.identity.workspaceId, id, true);
  }

  @Post('jobs/:id/capability-cards')
  generate(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.rubric.generate(req.identity.workspaceId, id, req.identity);
  }

  @Get('jobs/:id/rubric')
  getRubric(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.rubric.getRubric(req.identity.workspaceId, id);
  }

  @Patch('jobs/:id/rubric')
  updateRubric(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) {
    return this.rubric.update(req.identity, id, body);
  }

  @Post('jobs/:id/rubric/confirm')
  confirmRubric(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) {
    return this.rubric.confirm(req.identity, id, body);
  }

  @Post('jobs/:id/rubric/new-version')
  newRubricVersion(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.rubric.newVersion(req.identity, id);
  }
}
