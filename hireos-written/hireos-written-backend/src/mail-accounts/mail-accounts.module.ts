import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { MailAccountsController } from './mail-accounts.controller';
import { MailAccountsService } from './mail-accounts.service';
import { MailService } from './mail.service';

@Module({
  imports: [AuthModule],
  providers: [PrismaService, MailAccountsService, MailService],
  controllers: [MailAccountsController],
  exports: [MailAccountsService],
})
export class MailAccountsModule {}
