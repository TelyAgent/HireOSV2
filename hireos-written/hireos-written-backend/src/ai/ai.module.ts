import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { AiController } from './ai.controller';
import { AiQuestionGeneratorService } from './ai-question-generator.service';
import { AiEvaluatorService } from './ai-evaluator.service';

@Module({
  imports: [AuthModule],
  providers: [PrismaService, AiQuestionGeneratorService, AiEvaluatorService],
  controllers: [AiController],
  exports: [AiEvaluatorService],
})
export class AiModule {}
