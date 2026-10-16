import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(
    @Body('name') name: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new BadRequestException('Project name is required');
    }

    return this.projectsService.create(name.trim(), req.user.sub);
  }

  @Get()
  findMine(@Req() req: AuthenticatedRequest) {
    return this.projectsService.findMine(req.user.sub);
  }

  @Get(':id/services')
  async findServices(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const project = await this.projectsService.findOwnedProject(
      id,
      req.user.sub,
    );

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.projectsService.findServices(id);
  }
}