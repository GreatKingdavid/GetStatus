import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireWorkspaceRole(
    workspaceId: number,
    userId: number,
    canWrite: boolean,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    if (
      canWrite &&
      membership.role !== 'OWNER' &&
      membership.role !== 'ADMIN'
    ) {
      throw new ForbiddenException('Insufficient workspace permissions');
    }

    return membership;
  }

  async create(name: string, ownerId: number) {
    const membership = await this.prisma.membership.findFirst({
      where: { userId: ownerId, role: { in: ['OWNER', 'ADMIN'] } },
      orderBy: { createdAt: 'asc' },
      select: { workspaceId: true },
    });

    if (!membership) {
      throw new ForbiddenException('No writable workspace found');
    }

    return this.prisma.project.create({
      data: {
        name,
        ownerId,
        workspaceId: membership.workspaceId,
      },
    });
  }

  async findMine(userId: number) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { workspaceId: true },
    });

    const workspaceIds = memberships.map((membership) => membership.workspaceId);

    return this.prisma.project.findMany({
      where: {
        OR: [
          { workspaceId: { in: workspaceIds } },
          { workspaceId: null, ownerId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOwnedProject(id: number, userId: number) {
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        OR: [
          {
            workspace: {
              memberships: { some: { userId } },
            },
          },
          { workspaceId: null, ownerId: userId },
        ],
      },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      return null;
    }

    return { id: project.id, workspaceId: project.workspaceId };
  }

  async findServices(projectId: number) {
    return this.prisma.service.findMany({
      where: { projectId },
      include: {
        checks: {
          orderBy: { checkedAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}