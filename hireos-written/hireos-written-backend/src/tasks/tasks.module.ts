import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { CoreRecordClient } from '../core-record/core-record.client';

@Module({
  imports: [AuthModule],
  controllers: [TasksController],
  providers: [PrismaService, TasksService, CoreRecordClient],
})
export class TasksModule {}
