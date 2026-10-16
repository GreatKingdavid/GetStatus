
import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async register(email: string, password: string) {
    if (
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      password.length < 8
    ) {
      throw new BadRequestException(
        'A valid email and password of at least 8 characters are required',
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
          },
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        });

        const workspace = await tx.workspace.create({
          data: {
            name: `${normalizedEmail}'s workspace`,
          },
        });

        await tx.membership.create({
          data: {
            userId: user.id,
            workspaceId: workspace.id,
            role: 'OWNER',
          },
        });

        return user;
      });
    } catch (error) {
      // Handles duplicate registrations that race after the initial lookup.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }
  }
}
