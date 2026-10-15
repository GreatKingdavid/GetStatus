import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string, ownerId: number) {
    return this.prisma.project.create({
      data: {
        name,
        ownerId,
      },
    });
  }
}