import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../persistence/prisma.service';
import { PlanItemsController } from './plan-items.controller';
import { PlanItemsService } from './plan-items.service';

@Module({
  imports: [AuthModule],
  providers: [PrismaService, PlanItemsService],
  controllers: [PlanItemsController],
})
export class PlanItemsModule {}
