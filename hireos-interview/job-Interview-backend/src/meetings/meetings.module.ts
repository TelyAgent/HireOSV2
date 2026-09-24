import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { WorkspaceGuard } from '../intake/workspace.guard';
import { ZoomHostService } from './zoom-host.service';
import { ZoomHostController } from './zoom-host.controller';
import { ZoomOAuthController } from './zoom-oauth.controller';
import { RtmsService } from './rtms.service';
import { PrismaService } from '../persistence/prisma.service';

@Module({ controllers: [MeetingsController, ZoomHostController, ZoomOAuthController], providers: [MeetingsService, WorkspaceGuard, ZoomHostService, RtmsService, PrismaService], exports: [RtmsService, ZoomHostService] })
export class MeetingsModule {}
