import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { CreatePlanItemDto, UpdatePlanItemDto } from './plan-item.dto';
import { PlanItemsService } from './plan-items.service';

@Controller('cases/:caseId/plan-items')
@UseGuards(WorkspaceGuard)
export class PlanItemsController {
  constructor(private readonly planItems: PlanItemsService) {}

  @Get()
  list(@Param('caseId') caseId: string, @Req() req: { identity: Identity }) {
    return this.planItems.list(req.identity, caseId);
  }

  @Post()
  create(@Param('caseId') caseId: string, @Body() dto: CreatePlanItemDto, @Req() req: { identity: Identity }) {
    return this.planItems.create(req.identity, caseId, dto);
  }

  @Patch(':id')
  update(@Param('caseId') caseId: string, @Param('id') id: string, @Body() dto: UpdatePlanItemDto, @Req() req: { identity: Identity }) {
    return this.planItems.update(req.identity, caseId, id, dto);
  }

  @Delete(':id')
  remove(@Param('caseId') caseId: string, @Param('id') id: string, @Req() req: { identity: Identity }) {
    return this.planItems.remove(req.identity, caseId, id);
  }
}
