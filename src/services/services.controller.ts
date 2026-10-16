
import {
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

import { ServicesService } from './services.service';

@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  create(
    @Body() body: { name: string; url: string; projectId: number },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.servicesService.create(
      body.name,
      body.url,
      Number(body.projectId),
      req.user.sub,
    );
  }

  @Post(':id/check')
  check(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.servicesService.check(id, req.user.sub);
  }
}
