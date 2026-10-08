import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { CreateQuestionDto, UpdateQuestionDto } from './question.dto';
import { QuestionsService } from './questions.service';

@Controller('questions')
@UseGuards(WorkspaceGuard)
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  list(@Req() req: { identity: Identity }) {
    return this.questions.list(req.identity);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: { identity: Identity }) {
    return this.questions.get(req.identity, id);
  }

  @Post()
  create(@Body() dto: CreateQuestionDto, @Req() req: { identity: Identity }) {
    return this.questions.create(req.identity, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuestionDto, @Req() req: { identity: Identity }) {
    return this.questions.update(req.identity, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { identity: Identity }) {
    return this.questions.remove(req.identity, id);
  }
}
