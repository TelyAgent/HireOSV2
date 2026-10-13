import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminGuard, SessionGuard, type AuthedRequest } from '../auth/session.guard';
import { UsersService } from './users.service';

const inviteSchema = z.object({
  email: z.string().max(254),
  displayName: z.string().trim().min(1).max(100),
  roles: z.array(z.string()).min(1),
  locale: z.enum(['zh', 'en']).optional(),
  sendEmail: z.boolean().optional(),
});
const updateSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  roles: z.array(z.string()).min(1).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: result.error.message });
  return result.data;
}

@Controller('users')
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Any signed-in member: resolves stored user ids to names/avatars for display. */
  @Get('lookup')
  lookup(@Query('ids') ids: string | undefined) {
    return this.users.lookup((ids || '').split(',').map((id) => id.trim()).filter(Boolean));
  }

  @Get()
  @UseGuards(AdminGuard)
  list() {
    return this.users.list();
  }

  @Post('invite')
  @UseGuards(AdminGuard)
  invite(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.users.invite(req.auth, parse(inviteSchema, body));
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.users.update(req.auth, id, parse(updateSchema, body));
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.users.remove(req.auth, id);
  }
}
