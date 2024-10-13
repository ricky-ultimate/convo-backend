import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis-mock';

describe('AuthService', () => {
  let authService: AuthService;
  let redisClient: InstanceType<typeof Redis>;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        PrismaService,
        JwtService,
        ConfigService,
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Mock Redis instance
    redisClient = new Redis();
    (authService as any).redisClient = redisClient; // Inject mocked Redis client
  });

  it('should store session in Redis upon login', async () => {
    const mockUser = { id: 1, username: 'tes1', email: 'test1@test.com' };
    const token = 'mock-token';

    jest.spyOn(authService['jwtService'], 'sign').mockReturnValue(token);
    const result = await authService.login(mockUser);

    // Check that Redis stored the token
    const storedToken = await redisClient.get(`user:session:${mockUser.id}`);
    expect(storedToken).toBe(token);
    expect(result.access_token).toBe(token);
  });

  it('should validate session from Redis', async () => {
    const mockUserId = 1;
    const mockToken = 'mock-token';

    await redisClient.set(`user:session:${mockUserId}`, mockToken);
    const sessionValid = await authService.isSessionValid(mockUserId, mockToken);

    expect(sessionValid).toBe(true);
  });

  it('should invalidate session (logout) by deleting Redis key', async () => {
    const mockUserId = 1;
    const mockToken = 'mock-token';

    await redisClient.set(`user:session:${mockUserId}`, mockToken);
    await authService.logout(mockUserId);

    const storedToken = await redisClient.get(`user:session:${mockUserId}`);
    expect(storedToken).toBe(null);
  });
});
