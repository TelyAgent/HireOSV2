import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoreRecordClient } from '../core/core-record.client';
import { DraftsModule } from '../drafts/drafts.module';
import { PrismaService } from '../persistence/prisma.service';
import { CopilotController } from './copilot.controller';
import { CopilotObservabilityController } from './copilot-observability.controller';
import { CopilotService } from './copilot.service';
import { DocRewriteController } from './doc-rewrite.controller';
import { DocRewriteService } from './doc-rewrite.service';
import { LlmProvider } from './llm-provider';
import { PromptRegistry } from './prompt-registry';

@Module({
  imports: [AuthModule, DraftsModule],
  controllers: [CopilotController, CopilotObservabilityController, DocRewriteController],
  providers: [PrismaService, LlmProvider, PromptRegistry, CoreRecordClient, CopilotService, DocRewriteService],
})
export class CopilotModule {}
