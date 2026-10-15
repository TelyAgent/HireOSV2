import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { IntakeController } from './intake.controller';
import { ScreeningHandoffService } from './screening-handoff.service';
import { QuickStartService } from './quick-start.service';
import { CoreRecordClient } from '../core-record/core-record.client';
import { JdContentFacade } from '../core-record/jd-content.facade';

@Module({
  imports: [AuthModule],
  controllers: [IntakeController],
  providers: [PrismaService, ScreeningHandoffService, QuickStartService, CoreRecordClient, JdContentFacade],
})
export class IntakeModule {}
