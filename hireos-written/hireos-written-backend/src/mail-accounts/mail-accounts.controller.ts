import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceGuard, type Identity } from '../auth/workspace.guard';
import { CreateMailAccountDto, SetMailAccountEnabledDto, TestMailAccountDto, UpdateMailAccountDto } from './mail-account.dto';
import { MailAccountsService } from './mail-accounts.service';

@Controller('settings/mail-accounts')
@UseGuards(WorkspaceGuard)
export class MailAccountsController {
  constructor(private readonly mailAccounts: MailAccountsService) {}

  @Get()
  list(@Req() req: { identity: Identity }) {
    return this.mailAccounts.list(req.identity);
  }

  @Post('test')
  test(@Body() dto: TestMailAccountDto) {
    return this.mailAccounts.testConnection(dto);
  }

  @Post()
  create(@Body() dto: CreateMailAccountDto, @Req() req: { identity: Identity }) {
    return this.mailAccounts.create(req.identity, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMailAccountDto, @Req() req: { identity: Identity }) {
    return this.mailAccounts.update(req.identity, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { identity: Identity }) {
    return this.mailAccounts.remove(req.identity, id);
  }

  @Post(':id/enabled')
  setEnabled(@Param('id') id: string, @Body() dto: SetMailAccountEnabledDto, @Req() req: { identity: Identity }) {
    return this.mailAccounts.setEnabled(req.identity, id, dto.enabled);
  }
}
