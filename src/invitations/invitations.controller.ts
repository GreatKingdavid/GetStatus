import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';
import { InvitationsService } from './invitations.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('workspaces/:id/invitations')
  create(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { email: string; role: 'ADMIN' | 'VIEWER' },
    @Req() req: AuthenticatedRequest,
  ) {
    if (
  typeof body?.email !== 'string' ||
  (body.role !== 'ADMIN' && body.role !== 'VIEWER')
) {
  throw new BadRequestException('Email and role are required');
}

    return this.invitationsService
      .create(id, req.user.sub, body.email, body.role)
      .then(({ invitation, token }) => ({ ...invitation, token }));
  }

  @Post('invitations/accept')
  accept(
    @Body('token') token: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.invitationsService.accept(
      token,
      req.user.sub,
      req.user.email,
    );
  }
}
