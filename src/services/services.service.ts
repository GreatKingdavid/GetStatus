
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);
  private readonly inFlightChecks = new Map<number, Promise<any>>();

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

    return this.executeCheck(service);
  }

  async checkAllAutomatically() {
    const services = await this.prisma.service.findMany({
      select: { id: true },
    });

    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < services.length) {
        const service = services[nextIndex++];

        try {
          await this.checkAutomatically(service.id);
        } catch (error) {
          this.logger.error(
            `Automatic check failed for service ${service.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    };

    const workerCount = Math.min(10, services.length);

    await Promise.all(
      Array.from({ length: workerCount }, () => worker()),
    );
  }

  private async checkAutomatically(serviceId: number) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return;
    }

    return this.executeCheck(service);
  }

  private executeCheck(service: { id: number; url: string }) {
    const existingCheck = this.inFlightChecks.get(service.id);

    if (existingCheck) {
      return existingCheck;
    }

    const checkPromise = this.performCheck(service).finally(() => {
      this.inFlightChecks.delete(service.id);
    });

    this.inFlightChecks.set(service.id, checkPromise);

    return checkPromise;
  }

  private async performCheck(service: { id: number; url: string }) {
    const start = Date.now();

    let statusCode: number | undefined;
    let success = false;
    let error: string | undefined;

    // Initial attempt + one retry.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(service.url, {
          signal: AbortSignal.timeout(10_000),
        });

        statusCode = response.status;
        success = response.ok;
        error = undefined;

        if (success) {
          break;
        }
      } catch {
        statusCode = undefined;
        success = false;
        error = 'Request failed or timed out';
      }
    }

    return this.prisma.checkResult.create({
      data: {
        serviceId: service.id,
        statusCode,
        responseTime: Date.now() - start,
        success,
        error,
      },
    });
  }
}
