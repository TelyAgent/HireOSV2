import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { IntakeModule } from './intake/intake.module';
import { TasksModule } from './tasks/tasks.module';
import { AiModule } from './ai/ai.module';
import { InvitationsModule } from './invitations/invitations.module';
import { PlanItemsModule } from './plan-items/plan-items.module';
import { MailAccountsModule } from './mail-accounts/mail-accounts.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), HealthModule, AuthModule, IntakeModule, TasksModule, AiModule, InvitationsModule, PlanItemsModule, MailAccountsModule],
})
export class AppModule {}
