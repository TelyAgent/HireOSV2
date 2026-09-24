import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { IntakeController } from './intake.controller';
import { ScreeningHandoffService } from './screening-handoff.service';

@Module({
  imports: [AuthModule],
  controllers: [IntakeController],
  providers: [PrismaService, ScreeningHandoffService],
})
export class IntakeModule {}
