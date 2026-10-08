import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { MailAccountsModule } from '../mail-accounts/mail-accounts.module';
import { AiModule } from '../ai/ai.module';
import { CaseResultController } from './case-result.controller';
import { InvitationsController } from './invitations.controller';
import { PublicInvitationsController } from './public-invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [AuthModule, MailAccountsModule, AiModule],
  providers: [PrismaService, InvitationsService],
  controllers: [InvitationsController, CaseResultController, PublicInvitationsController],
})
export class InvitationsModule {}
