import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  imports: [AuthModule],
  providers: [PrismaService, QuestionsService],
  controllers: [QuestionsController],
})
export class QuestionsModule {}
