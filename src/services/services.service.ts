import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string, url: string, projectId: number) {
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    return this.prisma.service.create({
      data: {
        name,
        url,
        projectId,
      },
    });
  }

  async check(serviceId: number) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new BadRequestException('Service not found');
    }

    const start = Date.now();

    try {
      const response = await fetch(service.url);
      const responseTime = Date.now() - start;

      const result = await this.prisma.checkResult.create({
        data: {
          serviceId: service.id,
          statusCode: response.status,
          responseTime,
          checkedAt: new Date(),
          success: response.ok,
        },
      });

      return result;
    } catch (error) {
      const responseTime = Date.now() - start;

      return this.prisma.checkResult.create({
        data: {
          serviceId: service.id,
          responseTime,
          checkedAt: new Date(),
          success: false,
          error: 'Request failed',
        },
      });
    }
  }
}