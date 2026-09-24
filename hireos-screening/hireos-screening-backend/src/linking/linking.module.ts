import { Module } from '@nestjs/common';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';
import { LinkingController } from './linking.controller';
import { LinkingService } from './linking.service';
import { CoreRecordModule } from '../core-record/core-record.module';
import { ScreeningModule } from '../screening/screening.module';

@Module({
  imports: [CoreRecordModule, ScreeningModule],
  controllers: [LinkingController],
  providers: [PrismaService, WorkspaceGuard, LinkingService],
  exports: [LinkingService],
})
export class LinkingModule {}
