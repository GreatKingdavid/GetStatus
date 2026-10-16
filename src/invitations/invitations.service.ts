import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(
    workspaceId: number,
    userId: number,
    email: string,
    role: 'ADMIN' | 'VIEWER',
  ) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new BadRequestException('A valid email is required');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new ForbiddenException('You cannot invite members to this workspace');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        email: normalizedEmail,
        role,
        tokenHash: this.hashToken(token),
        expiresAt,
        workspaceId,
        invitedById: userId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return { invitation, token };
  }  async accept(token: string, userId: number, userEmail: string) {
    if (!token || token.length !== 64) {
      throw new BadRequestException('Invalid invitation token');
    }

    const tokenHash = this.hashToken(token);
    const normalizedEmail = userEmail.trim().toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { tokenHash },
      });

      if (!invitation || invitation.status !== 'PENDING') {
        throw new NotFoundException('Invitation is invalid or already used');
      }

      if (invitation.expiresAt <= new Date()) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
        throw new BadRequestException('Invitation has expired');
      }

      if (invitation.email.toLowerCase() !== normalizedEmail) {
        throw new ForbiddenException(
          'Sign in with the email address that was invited',
        );
      }

      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, status: 'PENDING' },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedById: userId,
        },
      });

      if (claimed.count !== 1) {
        throw new BadRequestException('Invitation has already been used');
      }

      await tx.membership.upsert({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: invitation.workspaceId,
          },
        },
        create: {
          userId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
        update: {},
      });

      return {
        success: true,
        workspaceId: invitation.workspaceId,
      };
    });
  }
}
