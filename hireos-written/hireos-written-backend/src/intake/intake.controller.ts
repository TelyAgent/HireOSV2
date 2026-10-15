import { Body, Controller, Get, Headers, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { ScreeningHandoffDto } from './screening-handoff.dto';
import { ScreeningHandoffService } from './screening-handoff.service';
import { QuickStartService } from './quick-start.service';
import type { UploadedFile as UploadedFileLike } from './text-extraction';

@Controller()
@UseGuards(WorkspaceGuard)
export class IntakeController {
  constructor(
    private readonly screeningHandoff: ScreeningHandoffService,
    private readonly quickStartService: QuickStartService,
  ) {}

  @Post('intake/screening-handoff')
  ingestScreeningHandoff(@Req() req: { identity: Identity }, @Body() body: ScreeningHandoffDto) {
    return this.screeningHandoff.ingest(req.identity, body);
  }

  // The new-task entry: upload a JD file / résumé, pick an existing job, then create the case.
  @Post('materials')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } }))
  upload(@Req() req: { identity: Identity }, @UploadedFile() file?: UploadedFileLike) {
    return this.quickStartService.upload(req.identity, file);
  }

  @Get('external-jobs')
  searchJobs(@Req() req: { identity: Identity }, @Query('q') q?: string) {
    return this.quickStartService.searchJobs(req.identity, q);
  }

  @Post('quick-start')
  quickStart(@Req() req: { identity: Identity }, @Headers('idempotency-key') key: string | undefined, @Body() body: unknown) {
    return this.quickStartService.start(req.identity, body, key);
  }
}
