import { Body, Controller, Param, Post } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  create(
    @Body()
    body: {
      name: string;
      url: string;
      projectId: number;
    },
  ) {
    return this.servicesService.create(
      body.name,
      body.url,
      body.projectId,
    );
  }

  @Post(':id/check')
  check(@Param('id') id: string) {
    return this.servicesService.check(Number(id));
  }
}