import { Module } from '@nestjs/common';
import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule, // Ensure you have ConfigModule for reading env vars
    NestRedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'single', // Specify single instance Redis connection type
        url: configService.get<string>('REDIS_URL'), // Read Redis URL from env
      }),
      inject: [ConfigService],
    }),
  ],
})
export class RedisModule {}
