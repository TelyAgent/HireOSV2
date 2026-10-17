import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(WorkspaceGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  /** A page of tasks: `?limit=` (default 50, at most 200) and the previous page's `nextCursor` as `?cursor=` (#412). */
  @Get()
  list(@Req() req: { identity: Identity }, @Query() query: Record<string, unknown>) {
    return this.tasks.list(req.identity, query);
  }

  /** My Tasks figures over every task: `?assignee=` and a due range `?dueFrom=&dueTo=` (ISO) (#412). */
  @Get('stats')
  stats(@Req() req: { identity: Identity }, @Query() query: Record<string, unknown>) {
    return this.tasks.stats(req.identity, query);
  }
}
