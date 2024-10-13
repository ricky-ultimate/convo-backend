import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis-mock';
import { RateLimiterRedis } from 'rate-limiter-flexible';

describe('ChatGateway', () => {
  let chatGateway: ChatGateway;
  let redisClient: InstanceType<typeof Redis>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: ChatService,
          useValue: {
            // Mock implementation of ChatService methods
            isUserInRoom: jest.fn(),
            addMessage: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis-url'),
          },
        },
      ],
    }).compile();

    chatGateway = module.get<ChatGateway>(ChatGateway);

    // Mock Redis client and RateLimiterRedis
    redisClient = new Redis();
    (chatGateway as any).rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      points: 5,
      duration: 10,
    });
  });

  it('should allow message sending under rate limit', async () => {
    const socket = { id: 'socket1', data: { user: { username: 'tes1' } }, emit: jest.fn() } as any;
    const data = { roomId: 'room-1', content: 'Hello!' };

    jest.spyOn(chatGateway['chatService'], 'isUserInRoom').mockResolvedValue(true);
    await expect(chatGateway.handleMessage(socket, data)).resolves.not.toThrow();
  });

  it('should block message sending when rate limit is exceeded', async () => {
    const socket = { id: 'socket1', data: { user: { username: 'tes1' } }, emit: jest.fn() } as any;
    const data = { roomId: 'room-1', content: 'Hello!' };

    // Mock isUserInRoom to return true so the test goes beyond the room membership check
    jest.spyOn(chatGateway['chatService'], 'isUserInRoom').mockResolvedValue(true);

    // Mock the rate limiter to simulate exceeding the limit
    jest.spyOn(chatGateway['rateLimiter'], 'consume').mockRejectedValue(new Error('Rate limit exceeded'));

    await expect(chatGateway.handleMessage(socket, data)).rejects.toThrow('Rate limit exceeded');

    // Ensure that the 'error' event is emitted with the correct message
    expect(socket.emit).toHaveBeenCalledWith('error', 'Rate limit exceeded. Please slow down.');
  });

});
