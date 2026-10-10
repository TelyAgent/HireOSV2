import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { VersionsService } from './versions.service';

/** JD ID, published versions, and Publish (which writes the next version). */
@Controller('jobs/:jobId')
@UseGuards(WorkspaceGuard)
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  @Get('versions')
  list(@Req() req: { identity: Identity }, @Param('jobId') jobId: string) {
    return this.versions.list(req.identity, jobId);
  }

  @Post('publish')
  publish(@Req() req: { identity: Identity }, @Param('jobId') jobId: string, @Body() body: unknown) {
    return this.versions.publish(req.identity, jobId, body);
  }
}
