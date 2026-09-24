import { Body, Controller, Get, Headers, Param, Post, Req, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { MaterialsService } from './materials.service';
import type { RequestMeta } from '../records';

@Controller('materials')
@UseGuards(WorkspaceGuard)
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 1 } }))
  create(
    @Req() req: { identity: Identity },
    @Headers() headers: Record<string, string | undefined>,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('candidateId') candidateId: string | undefined,
  ) {
    return this.materials.create(req.identity, file, candidateId, meta(headers));
  }

  @Get(':id')
  get(@Req() req: { identity: Identity }, @Param('id') id: string) {
    return this.materials.get(req.identity, id);
  }

  @Get(':id/download')
  download(@Req() req: { identity: Identity }, @Headers() headers: Record<string, string | undefined>, @Param('id') id: string) {
    return this.materials.download(req.identity, id, meta(headers));
  }

  @Get(':id/content')
  async content(@Req() req: { identity: Identity }, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { stream, name, mime } = await this.materials.readContent(req.identity, id);
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
    });
    return new StreamableFile(stream);
  }
}

function meta(headers: Record<string, string | undefined>): RequestMeta {
  return {
    requestId: headers['x-request-id'],
    correlationId: headers['x-correlation-id'],
    idempotencyKey: headers['idempotency-key'],
  };
}
