import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { AiController } from './ai.controller';
import { AiQuestionGeneratorService } from './ai-question-generator.service';

@Module({
  imports: [AuthModule],
  providers: [PrismaService, AiQuestionGeneratorService],
  controllers: [AiController],
})
export class AiModule {}
