import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuthController } from './auth/auth.controller';
import { ChatService } from './chat/chat.service';
import { ChatModule } from './chat/chat.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, AuthModule, ChatModule, RedisModule, ConfigModule.forRoot({isGlobal: true, envFilePath: '.env'})],
  controllers: [AppController, AuthController],
  providers: [AppService, ChatService],
})
export class AppModule {}
