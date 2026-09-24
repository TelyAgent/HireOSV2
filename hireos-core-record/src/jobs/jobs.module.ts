import { Module } from '@nestjs/common';
import { WorkspaceGuard } from '../auth/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { RoleVersionsController } from './role-versions.controller';
import { RoleVersionsService } from './role-versions.service';

@Module({
  controllers: [JobsController, RoleVersionsController],
  providers: [PrismaService, WorkspaceGuard, JobsService, RoleVersionsService],
})
export class JobsModule {}
