import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: number) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map(({ workspace, role, createdAt }) => ({
      ...workspace,
      role,
      joinedAt: createdAt,
    }));
  }

  async listMembers(workspaceId: number, userId: number) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    return this.prisma.membership.findMany({
      where: { workspaceId },
      select: {
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
