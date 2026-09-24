import { Module } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { MeetingsModule } from '../meetings/meetings.module';
import { AiService } from './ai.service';
import { IntakeController } from './intake.controller';
import { MaterialsService } from './materials.service';
import { CandidatesService } from './candidates.service';
import { JobsService } from './jobs.service';
import { TasksService } from './tasks.service';
import { RoundsService } from './rounds.service';
import { ParsingService } from './parsing.service';
import { ScreeningHandoffService } from './screening-handoff.service';
import { WorkspaceGuard } from './workspace.guard';
import { CoreRecordClient } from '../core-record/core-record.client';
import { JdContentFacade } from '../core-record/jd-content.facade';

@Module({
  imports: [MeetingsModule],
  controllers: [IntakeController],
  providers: [
    PrismaService, AiService, MaterialsService, CandidatesService, JobsService, TasksService,
    RoundsService, ParsingService, ScreeningHandoffService, WorkspaceGuard, CoreRecordClient, JdContentFacade,
  ],
})
export class IntakeModule {}
