import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { ScreeningBatchesService } from './screening-batches.service';

@Controller()
@UseGuards(WorkspaceGuard)
export class ScreeningBatchesController {
  constructor(private readonly batches: ScreeningBatchesService) {}
  @Post('jobs/:jobId/screening-batches')
  start(@Req() req: { identity: Identity }, @Param('jobId') jobId: string, @Body() body: unknown) { return this.batches.start(req.identity, jobId, body); }
  @Get('jobs/:jobId/screening-batches')
  list(@Req() req: { identity: Identity }, @Param('jobId') jobId: string) { return this.batches.list(req.identity, jobId); }
  @Get('screening-batches/:id')
  get(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.batches.get(req.identity, id); }
  @Post('screening-batches/:id/cancel')
  cancel(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.batches.cancel(req.identity, id); }
  @Post('screening-batches/:id/reconcile')
  reconcile(@Req() req: { identity: Identity }, @Param('id') id: string) { return this.batches.reconcile(req.identity, id); }
  @Post('screening-batches/:id/items/:itemId/retry')
  retry(@Req() req: { identity: Identity }, @Param('id') id: string, @Param('itemId') itemId: string, @Body() body: unknown) { return this.batches.retry(req.identity, id, itemId, body); }
}
