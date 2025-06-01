import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id };
    const token = this.jwtService.sign(payload);
    const sessionKey = `user:session:${user.id}`;

    const stored = await this.redisService.set(sessionKey, token, 3600);
    if (!stored) {
      this.logger.warn(`Failed to store session in Redis for user ${user.id}`);
    }

    return token;
  }

  async extendSessionTTL(userId: string): Promise<void> {
    const sessionKey = `user:session:${userId}`;
    const extended = await this.redisService.expire(sessionKey, 3600);

    if (extended) {
      this.logger.log(`Extended session TTL for user ${userId}`);
    } else {
      this.logger.warn(`Failed to extend session TTL for user ${userId}`);
    }
  }

  async isSessionValid(userId: string, token: string): Promise<boolean> {
    const sessionKey = `user:session:${userId}`;
    const isRedisAvailable = await this.redisService.ping();

    if (!isRedisAvailable) {
      this.logger.warn(
        'Redis is not available, falling back to JWT validation only',
      );

      try {
        const decoded = this.jwtService.verify(token);
        return decoded.sub === userId;
      } catch (error) {
        this.logger.error(
          `JWT validation failed for user ${userId}: ${error.message}`,
        );
        return false;
      }
    }

    const storedToken = await this.redisService.get(sessionKey);

    if (!storedToken) {
      this.logger.warn(`No session found in Redis for user ${userId}`);
      return false;
    }

    return storedToken === token;
  }
  async register(email: string, username: string, password: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new UnauthorizedException('Email already registered');
      }
      if (existingUser.username === username) {
        throw new UnauthorizedException('Username already taken');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
        },
      });

      return this.login(user);
    } catch (error) {
      this.logger.error(`Registration failed: ${error.message}`);
      throw new UnauthorizedException('Registration failed');
    }
  }

  async logout(userId: string): Promise<boolean> {
    const sessionKey = `user:session:${userId}`;
    const deleted = await this.redisService.del(sessionKey);

    if (deleted) {
      this.logger.log(`Session deleted for user ${userId}`);
    } else {
      this.logger.warn(`Failed to delete session for user ${userId}`);
    }

    return deleted;
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
