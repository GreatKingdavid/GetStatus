
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { lookup } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { TLSSocket } from 'node:tls';
import { performance } from 'node:perf_hooks';

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
      throw new BadRequestException(
        'Only HTTP and HTTPS URLs are supported',
      );
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

  async delete(serviceId: number, userId: number) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        project: {
          select: {
            id: true,
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

    if (this.inFlightChecks.has(serviceId)) {
      throw new BadRequestException(
        'Cannot delete a service while it is being checked',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Delete all monitoring history belonging to this service.
        await tx.checkResult.deleteMany({
          where: { serviceId },
        });

        // Delete the service after its history has been removed.
        await tx.service.delete({
          where: { id: serviceId },
        });
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error
      ) {
        if (error.code === 'P2003') {
          throw new BadRequestException(
            'The service could not be deleted because related records still exist',
          );
        }

        if (error.code === 'P2025') {
          throw new NotFoundException('Service not found');
        }
      }

      throw error;
    }

    return {
      message: 'Service and its monitoring history deleted successfully',
    };
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

  private async measureDns(hostname: string): Promise<number | null> {
    const start = performance.now();

    try {
      await new Promise<void>((resolve, reject) => {
        lookup(hostname, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      return Math.round(performance.now() - start);
    } catch {
      return null;
    }
  }

  private async performHttpCheck(url: URL): Promise<{
    statusCode: number;
    dnsResolutionTime: number | null;
    sslValid: boolean | null;
    sslExpiresAt: Date | null;
  }> {
    const dnsResolutionTime = await this.measureDns(url.hostname);

    return new Promise((resolve, reject) => {
      const isHttps = url.protocol === 'https:';

      let sslValid: boolean | null = null;
      let sslExpiresAt: Date | null = null;

      const captureTlsInfo = (socket: TLSSocket) => {
        if (!isHttps || !socket.encrypted) {
          return;
        }

        const certificate = socket.getPeerCertificate();

        if (!certificate || Object.keys(certificate).length === 0) {
          return;
        }

        const expiresAt = certificate.valid_to
          ? new Date(certificate.valid_to)
          : null;

        sslValid =
          socket.authorized &&
          expiresAt !== null &&
          !Number.isNaN(expiresAt.getTime()) &&
          expiresAt.getTime() > Date.now();

        if (
          expiresAt &&
          !Number.isNaN(expiresAt.getTime())
        ) {
          sslExpiresAt = expiresAt;
        }
      };

      const request = (isHttps ? httpsRequest : httpRequest)(
        url,
        {
          method: 'GET',
          timeout: 10_000,
        },
        (response) => {
          const statusCode = response.statusCode ?? 0;

          if (isHttps && response.socket) {
            captureTlsInfo(response.socket as TLSSocket);
          }

          response.on('error', reject);

          response.on('aborted', () => {
            reject(new Error('Response aborted'));
          });

          response.on('end', () => {
            resolve({
              statusCode,
              dnsResolutionTime,
              sslValid,
              sslExpiresAt,
            });
          });

          response.resume();
        },
      );

      if (isHttps) {
        request.on('socket', (socket) => {
          const tlsSocket = socket as TLSSocket;

          tlsSocket.once('secureConnect', () => {
            captureTlsInfo(tlsSocket);
          });
        });
      }

      request.on('timeout', () => {
        request.destroy(new Error('Request timed out'));
      });

      request.on('error', reject);

      request.end();
    });
  }

  private async performCheck(service: { id: number; url: string }) {
    const start = Date.now();

    let statusCode: number | undefined;
    let success = false;
    let error: string | undefined;
    let dnsResolutionTime: number | null = null;
    let sslValid: boolean | null = null;
    let sslExpiresAt: Date | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = new URL(service.url);
        const result = await this.performHttpCheck(url);

        statusCode = result.statusCode;
        dnsResolutionTime = result.dnsResolutionTime;
        sslValid = result.sslValid;
        sslExpiresAt = result.sslExpiresAt;

        success = statusCode >= 200 && statusCode < 400;
        error = undefined;

        if (success) {
          break;
        }
      } catch (checkError) {
        statusCode = undefined;
        success = false;
        error =
          checkError instanceof Error
            ? checkError.message
            : 'Request failed';
      }
    }

    return this.prisma.checkResult.create({
      data: {
        serviceId: service.id,
        statusCode,
        responseTime: Date.now() - start,
        dnsResolutionTime,
        sslValid,
        sslExpiresAt,
        success,
        error,
      },
    });
  }
}


