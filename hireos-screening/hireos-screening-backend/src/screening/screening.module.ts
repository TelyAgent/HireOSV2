import { Module } from '@nestjs/common';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';
import { ScreeningController } from './screening.controller';
import { ScreeningService } from './screening.service';
import { AiScreeningEvaluatorService } from './ai-screening-evaluator.service';
import { ScreeningBatchesService } from './screening-batches.service';
import { ScreeningBatchesController } from './screening-batches.controller';

@Module({
  controllers: [ScreeningController, ScreeningBatchesController],
  providers: [PrismaService, WorkspaceGuard, ScreeningService, AiScreeningEvaluatorService, ScreeningBatchesService],
  exports: [ScreeningService],
})
export class ScreeningModule {}
