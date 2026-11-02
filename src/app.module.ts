import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { ServicesModule } from './services/services.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { InvitationsModule } from './invitations/invitations.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    ProjectsModule,
    ServicesModule,
    AuthModule,
    WorkspacesModule,
    InvitationsModule,
  ],
})
export class AppModule {}
