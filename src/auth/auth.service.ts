import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Redis } from 'ioredis';

@Injectable()
export class AuthService {
  private redisClient: Redis;

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
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result; // Return the user details without the password
    }
    return null;
  }

  // Login and store session in Redis
  async login(user: any) {
    const payload = { username: user.username, sub: user.id };
    const token = this.jwtService.sign(payload);

    // Store session in Redis with expiration (optional: 1 hour)
    const sessionKey = `user:session:${user.id}`;
    await this.redisClient.set(sessionKey, token, 'EX', 3600); // Store JWT for 1 hour

    return { access_token: token };
  }

  // Check session validity in Redis
  async isSessionValid(userId: number, token: string): Promise<boolean> {
    const sessionKey = `user:session:${userId}`;
    const storedToken = await this.redisClient.get(sessionKey);
    return storedToken === token;
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
  // Invalidate session (for logout)
  async logout(userId: number) {
    const sessionKey = `user:session:${userId}`;
    await this.redisClient.del(sessionKey);
  }
}
