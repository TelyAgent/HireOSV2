import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AdminGuard, SessionGuard } from './auth/session.guard';
import { BootstrapService } from './bootstrap.service';
import { HealthController } from './health.controller';
import { IdentityConfig } from './identity.config';
import { InternalController } from './internal/internal.controller';
import { MailService } from './mail/mail.service';
import { PrismaService } from './persistence/prisma.service';
import { SessionsService } from './sessions/sessions.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, AuthController, UsersController, InternalController],
  providers: [PrismaService, IdentityConfig, MailService, SessionsService, AuthService, UsersService, SessionGuard, AdminGuard, BootstrapService],
})
export class AppModule {}
