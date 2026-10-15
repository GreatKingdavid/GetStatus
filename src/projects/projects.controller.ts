import { Body, Controller, Post } from '@nestjs/common';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(
    @Body() body: { name: string; ownerId: number },
  ) {
    return this.projectsService.create(body.name, body.ownerId);
  }
}