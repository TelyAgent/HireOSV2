import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { IntakeService } from './intake.service';

@Controller('intake')
@UseGuards(WorkspaceGuard)
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  /** Reads a JD without creating anything, so the recruiter can check the title and team first (#178). */
  @Post('jobs/preview')
  previewJob(@Req() req: { identity: Identity }, @Body() body: unknown) {
    return this.intake.previewJob(req.identity, body);
  }

  /** Called by other subsystems' backends (service token) when a recruiter starts a task from raw JD text. */
  @Post('jobs')
  createJob(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Body() body: unknown) {
    return this.intake.createJob(req.identity, body, {
      requestId: headers['x-request-id'],
      correlationId: headers['x-correlation-id'],
      idempotencyKey: headers['idempotency-key'],
      sourceService: headers['x-source-service'],
    });
  }
}
