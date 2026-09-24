import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(WorkspaceGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Req() req: { identity: Identity }) {
    return this.tasks.list(req.identity);
  }
}
