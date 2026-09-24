import { Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaterialsService } from './materials.service';
import { JobsService } from './jobs.service';
import { TasksService } from './tasks.service';
import { RoundsService } from './rounds.service';
import { ParsingService } from './parsing.service';
import { ScreeningHandoffService } from './screening-handoff.service';
import { WorkspaceGuard, type Identity } from './workspace.guard';

@Controller()
@UseGuards(WorkspaceGuard)
export class IntakeController {
  constructor(
    private readonly materials: MaterialsService,
    private readonly jobs: JobsService,
    private readonly tasks: TasksService,
    private readonly rounds: RoundsService,
    private readonly parsing: ParsingService,
    private readonly screeningHandoff: ScreeningHandoffService,
  ) {}
  @Post('materials')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } }))
  upload(@Req() req: { identity: Identity }, @UploadedFile() file?: Express.Multer.File) { return this.materials.upload(req.identity, file); }
  @Get('materials/:id')
  material(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.materials.get(req.identity.workspaceId, id); }

  // Interview has no JD authoring of its own -- these two replace the old JD-upload
  // flow: search Core Record's job directory, then attach the one the recruiter picked.
  @Get('external-jobs')
  searchExternalJobs(@Req() req: { identity: Identity }, @Query('q') q?: string) { return this.jobs.search(req.identity, q); }
  @Post('jobs/attach')
  attachJob(@Req() req: { identity: Identity }, @Body() body: unknown) { return this.jobs.attach(req.identity, body); }

  @Get('jobs')
  listJobs(@Req() req: { identity: Identity }) { return this.jobs.list(req.identity.workspaceId); }
  @Get('jobs/:id')
  job(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.jobs.get(req.identity.workspaceId, id); }

  @Post('jobs/:id/tasks')
  createTask(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) { return this.tasks.create(req.identity, id, body); }
  @Get('tasks')
  listTasks(@Req() req: { identity: Identity }) { return this.tasks.list(req.identity.workspaceId); }
  @Get('tasks/:id')
  task(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.tasks.get(req.identity.workspaceId, id); }
  @Patch('tasks/:id/intake')
  reviewTask(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) { return this.tasks.review(req.identity, id, body); }
  @Post('tasks/:id/materials')
  attachTaskMaterial(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) { return this.tasks.attach(req.identity, id, body); }

  @Get('tasks/:id/rounds')
  listRounds(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.rounds.listForTask(req.identity.workspaceId, id); }
  @Post('tasks/:id/rounds')
  createRound(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) { return this.rounds.createForTask(req.identity, id, body); }
  @Patch('rounds/:id')
  updateRound(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) { return this.rounds.update(req.identity, id, body); }
  @Post('rounds/:id/schedule')
  scheduleRound(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) { return this.rounds.schedule(req.identity, id, body); }
  @Get('rounds/:id/transcript')
  roundTranscript(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.rounds.transcript(req.identity.workspaceId, id); }
  @Get('rounds/:id/scores')
  roundScores(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.rounds.scores(req.identity.workspaceId, id); }
  @Patch('rounds/:id/scores/:cardId')
  setRoundScore(@Req() req: { identity: Identity }, @Param('id') id: string, @Param('cardId') cardId: string, @Body() body: unknown) { return this.rounds.setScore(req.identity, id, cardId, body); }
  @Post('rounds/:id/ai-scores')
  generateAiScores(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.rounds.generateAiScores(req.identity, id); }
  @Patch('rounds/:id/recommendation')
  setRoundRecommendation(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) { return this.rounds.setRecommendation(req.identity, id, body); }
  @Post('rounds/:id/complete')
  completeRound(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.rounds.complete(req.identity, id); }
  @Get('tasks/:id/debrief')
  taskDebrief(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.tasks.debrief(req.identity.workspaceId, id); }
  @Get('tasks/:id/decision')
  taskDecision(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.tasks.decision(req.identity.workspaceId, id); }
  @Post('tasks/:id/decision-draft')
  generateDecisionDraft(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.tasks.generateDecisionDraft(req.identity, id); }
  @Patch('tasks/:id/decision')
  setTaskDecision(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) { return this.tasks.setDecision(req.identity, id, body); }
  @Get('tasks/:id/package')
  taskPackage(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.tasks.package(req.identity.workspaceId, id); }
  @Patch('tasks/:id/package/confirm')
  confirmPackage(@Req() req: { identity: Identity }, @Param('id') id: string, @Body() body: unknown) { return this.tasks.confirmPackage(req.identity, id, body); }
  @Post('tasks/:id/package/offer')
  sendOffer(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.tasks.sendOffer(req.identity, id); }

  // Called by Screening's outbox dispatcher when a decision moves a candidate to
  // interview -- see docs/HireOS-Database-Architecture-Decision.md 路径三 and
  // screening-handoff.service.ts's own doc comment for why this is upsert-by-Core-
  // Record-id rather than Screening calling any of the create* endpoints above directly.
  @Post('screening-handoff')
  ingestScreeningHandoff(@Req() req: { identity: Identity }, @Body() body: unknown) { return this.screeningHandoff.ingest(req.identity, body); }

  @Get('parsing-jobs/:id')
  parsingJob(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.parsing.get(req.identity.workspaceId, id); }
  @Post('parsing-jobs/:id/retry')
  retry(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.parsing.retry(req.identity.workspaceId, id); }
}
