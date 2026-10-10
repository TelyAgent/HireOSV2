import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { CaseLifecycleService } from './case-lifecycle.service';
import { CasesController } from './cases.controller';

@Module({
  imports: [AuthModule],
  providers: [PrismaService, CaseLifecycleService],
  controllers: [CasesController],
  exports: [CaseLifecycleService],
})
export class CasesModule {}
