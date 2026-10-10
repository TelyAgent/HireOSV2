import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { CoreRecordClient } from '../core/core-record.client';
import { DraftsController } from './drafts.controller';
import { DraftsService } from './drafts.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';
import { VersionsController } from './versions.controller';
import { VersionsService } from './versions.service';

@Module({
  imports: [AuthModule],
  controllers: [DraftsController, DocumentsController, SuggestionsController, VersionsController],
  providers: [PrismaService, CoreRecordClient, DraftsService, DocumentsService, SuggestionsService, VersionsService],
  exports: [DraftsService],
})
export class DraftsModule {}
