import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApplicationsModule } from './applications/applications.module';
import { AuditModule } from './audit/audit.module';
import { CandidatesModule } from './candidates/candidates.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { MaterialsModule } from './materials/materials.module';
import { OutboxModule } from './outbox/outbox.module';
import { PrismaService } from './persistence/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    CandidatesModule,
    JobsModule,
    ApplicationsModule,
    MaterialsModule,
    AuditModule,
    OutboxModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
