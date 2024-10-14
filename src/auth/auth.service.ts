import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Redis } from 'ioredis';

@Injectable()
export class AuthService {
  private redisClient: Redis;
  private readonly logger = new Logger(AuthService.name); // Logger for Redis failure

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.redisClient = new Redis(this.configService.get<string>('REDIS_URL'));
  }

  // Validate user credentials (Login logic)
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result; // Return the user details without the password
    }
    return null;
  }

  // Login and store session in Redis with fallback to proceed without Redis
  async login(user: any) {
    const payload = { username: user.username, sub: user.id };
    const token = this.jwtService.sign(payload);
    const sessionKey = `user:session:${user.id}`;

    try {
      // Try to store session in Redis
      await this.redisClient.set(sessionKey, token, 'EX', 3600); // Store JWT for 1 hour
    } catch (error) {
      // Log Redis failure and proceed with login
      this.logger.error(
        `Failed to store session in Redis for user ${user.id}: ${error.message}`,
      );
    }

    return { access_token: token };
  }

  // Extend session TTL in Redis on user activity (e.g., sending a message)
  async extendSessionTTL(userId: number): Promise<void> {
    const sessionKey = `user:session:${userId}`;
    try {
      // Refresh TTL to 1 hour on user activity
      await this.redisClient.expire(sessionKey, 3600);
      this.logger.log(`Extended session TTL for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to extend session TTL in Redis for user ${userId}: ${error.message}`,
      );
    }
  }

  // Check session validity in Redis with fallback to always return true
  async isSessionValid(userId: number, token: string): Promise<boolean> {
    const sessionKey = `user:session:${userId}`;

    try {
      const storedToken = await this.redisClient.get(sessionKey);
      return storedToken === token;
    } catch (error) {
      // Log Redis failure and proceed as if the session is valid
      this.logger.error(
        `Failed to validate session in Redis for user ${userId}: ${error.message}`,
      );
      return true; // Default to true for user experience if Redis is down
    }
  }

  // Register user and return JWT
  async register(email: string, username: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
      },
    });

    // After successful registration, generate and return the JWT token
    return this.login(user);
  }

  // Invalidate session (logout) with fallback to proceed without Redis
  async logout(userId: number) {
    const sessionKey = `user:session:${userId}`;

    try {
      await this.redisClient.del(sessionKey);
    } catch (error) {
      // Log Redis failure and proceed with logout
      this.logger.error(
        `Failed to delete session in Redis for user ${userId}: ${error.message}`,
      );
    }
  }
}
