import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getProjectAccess(projectId: number, userId: number) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { workspace: { memberships: { some: { userId } } } },
          { workspaceId: null, ownerId: userId },
        ],
      },
      select: {
        id: true,
        workspaceId: true,
        ownerId: true,
        workspace: {
          select: {
            memberships: {
              where: { userId },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const role = project.workspace?.memberships[0]?.role;

    return {
      project,
      role: role ?? (project.ownerId === userId ? 'OWNER' : null),
    };
  }

  private assertCanWrite(role: string | null) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Insufficient workspace permissions');
    }
  }

  async create(
    name: string,
    url: string,
    projectId: number,
    userId: number,
  ) {
    if (!name?.trim()) {
      throw new BadRequestException('Service name is required');
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException('Only HTTP and HTTPS URLs are supported');
    }

    const { role } = await this.getProjectAccess(projectId, userId);
    this.assertCanWrite(role);

    return this.prisma.service.create({
      data: {
        name: name.trim(),
        url: parsedUrl.toString(),
        projectId,
      },
    });
  }

  async check(serviceId: number, userId: number) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        project: {
          select: {
            id: true,
            workspaceId: true,
            ownerId: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const { role } = await this.getProjectAccess(
      service.project.id,
      userId,
    );
    this.assertCanWrite(role);

    const start = Date.now();

    try {
      const response = await fetch(service.url, {
        signal: AbortSignal.timeout(10_000),
      });

      return await this.prisma.checkResult.create({
        data: {
          serviceId: service.id,
          statusCode: response.status,
          responseTime: Date.now() - start,
          success: response.ok,
        },
      });
    } catch {
      return this.prisma.checkResult.create({
        data: {
          serviceId: service.id,
          responseTime: Date.now() - start,
          success: false,
          error: 'Request failed or timed out',
        },
      });
    }
  }
}