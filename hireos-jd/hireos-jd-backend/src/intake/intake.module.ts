import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoreRecordClient } from '../core/core-record.client';
import { DraftsModule } from '../drafts/drafts.module';
import { PrismaService } from '../persistence/prisma.service';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { LlmProvider } from '../copilot/llm-provider';
import { PromptRegistry } from '../copilot/prompt-registry';

@Module({
  imports: [AuthModule, DraftsModule],
  controllers: [IntakeController],
  providers: [PrismaService, CoreRecordClient, IntakeService, LlmProvider, PromptRegistry],
})
export class IntakeModule {}
