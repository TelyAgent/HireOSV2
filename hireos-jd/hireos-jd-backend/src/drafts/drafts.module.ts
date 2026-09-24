import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { CoreRecordClient } from '../core/core-record.client';
import { DraftsController } from './drafts.controller';
import { DraftsService } from './drafts.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AuthModule],
  controllers: [DraftsController, DocumentsController],
  providers: [PrismaService, CoreRecordClient, DraftsService, DocumentsService],
  exports: [DraftsService],
})
export class DraftsModule {}
