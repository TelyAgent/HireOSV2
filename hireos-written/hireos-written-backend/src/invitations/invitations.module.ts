import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { InvitationsController } from './invitations.controller';
import { PublicInvitationsController } from './public-invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [AuthModule],
  providers: [PrismaService, InvitationsService],
  controllers: [InvitationsController, PublicInvitationsController],
})
export class InvitationsModule {}
