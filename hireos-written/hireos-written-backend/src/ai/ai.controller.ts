import { BadGatewayException, Body, Controller, Get, NotFoundException, Param, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';
import { AiCallError } from './ai-json-client';
import { AiQuestionGeneratorService } from './ai-question-generator.service';
import { GenerateQuestionDto } from './generate-question.dto';

@Controller()
@UseGuards(WorkspaceGuard)
export class AiController {
  constructor(
    private readonly db: PrismaService,
    private readonly generator: AiQuestionGeneratorService,
  ) {}

  // Best-effort prefill for the AI-generate drawer: only cases that arrived via a real screening
  // handoff have this row, so a 404 here just means "no extra JD/resume context available" -- the
  // frontend falls back to generating from jobTitle alone rather than treating it as an error.
  @Get('cases/:id/context')
  async context(@Param('id') id: string, @Req() req: { identity: Identity }) {
    const kase = await this.db.case.findFirst({
      where: { id, workspaceId: req.identity.workspaceId },
      include: { job: true, candidate: true },
    });
    if (!kase) throw new NotFoundException({ code: 'CASE_NOT_FOUND' });
    return {
      jobTitle: kase.job.title,
      jdText: kase.job.jdText,
      resumeText: kase.resumeText,
      candidateName: kase.candidate.name,
    };
  }

  @Post('ai/generate-question')
  async generateQuestion(@Body() dto: GenerateQuestionDto) {
    try {
      return await this.generator.generate(dto);
    } catch (error) {
      if (error instanceof AiCallError && error.message === 'AI_NOT_CONFIGURED') {
        throw new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED' });
      }
      const message = error instanceof AiCallError ? error.message : 'AI_GENERATE_FAILED';
      throw new BadGatewayException({ code: 'AI_GENERATE_FAILED', message });
    }
  }
}
