import { Module } from '@nestjs/common';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';
import { OutboxController } from './outbox.controller';
import { OutboxService } from './outbox.service';

@Module({
  controllers: [OutboxController],
  providers: [PrismaService, WorkspaceGuard, OutboxService],
})
export class OutboxModule {}
