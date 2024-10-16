import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis-mock';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { AuthService } from '../auth/auth.service';

describe('ChatGateway', () => {
  let chatGateway: ChatGateway;
  let redisClient: InstanceType<typeof Redis>;
  let authService: AuthService;
  let serverMock: { to: jest.Mock, emit: jest.Mock };

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
        {
         provide: AuthService,
         useValue: {
            extendSessionTTL: jest.fn(), // Mock session extension method
         }
        }
      ],
    }).compile();

    chatGateway = module.get<ChatGateway>(ChatGateway);
    authService = module.get<AuthService>(AuthService);

    // Mock Redis client and RateLimiterRedis
    redisClient = new Redis();
    (chatGateway as any).rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      points: 5,
      duration: 10,
    });

    // Mock WebSocket server with `to` and `emit` methods
    serverMock = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(), // Mock the `emit` method within `to`
      }),
      emit: jest.fn(), // Directly mock `emit` on the server
    };
    chatGateway.server = serverMock as any; // Assign mock server to chatGateway
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

    jest.spyOn(chatGateway['chatService'], 'isUserInRoom').mockResolvedValue(true);
    jest.spyOn(chatGateway['rateLimiter'], 'consume').mockRejectedValue(new Error('Rate limit exceeded'));

    await expect(chatGateway.handleMessage(socket, data)).rejects.toThrow('Rate limit exceeded');
    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Rate limit exceeded. Please slow down.', code: 'RATE_LIMIT' });
  });

  it('should extend session TTL when a user joins a room', async () => {
    const socket = { id: 'socket1', data: { user: { username: 'testuser', sub: 1 } }, join: jest.fn(), emit: jest.fn() } as any;
    const data = { roomId: 'room-1' };

    jest.spyOn(chatGateway['chatService'], 'isUserInRoom').mockResolvedValue(true);

    await chatGateway.handleJoinRoom(socket, data);

    // Check if extendSessionTTL was called
    expect(authService.extendSessionTTL).toHaveBeenCalledWith(1);
    // Ensure the mock server's 'to' method was called
    expect(serverMock.to).toHaveBeenCalledWith('room-1');
    // Ensure the 'emit' method inside 'to' was called
    expect(serverMock.to().emit).toHaveBeenCalledWith('userJoined', { username: 'testuser', roomId: 'room-1' });
  });

  it('should extend session TTL when a user sends a message', async () => {
    const socket = { id: 'socket1', data: { user: { username: 'testuser', sub: 1 } }, emit: jest.fn() } as any;
    const data = { roomId: 'room-1', content: 'Hello!' };
    const message = {
      id: 1,
      content: 'Hello',
      userId: 1,
      chatRoomId: 1,
      createdAt: new Date(),
      user: { username: 'testuser' },  // Ensure the user object is returned
    };

    jest.spyOn(chatGateway['chatService'], 'isUserInRoom').mockResolvedValue(true);
    jest.spyOn(chatGateway['chatService'], 'addMessage').mockResolvedValue(message);

    await chatGateway.handleMessage(socket, data);

    // Check if extendSessionTTL was called
    expect(authService.extendSessionTTL).toHaveBeenCalledWith(1);
    // Ensure the mock server's 'to' method was called
    expect(serverMock.to).toHaveBeenCalledWith('room-1');
    // Ensure the 'emit' method inside 'to' was called with the correct message structure
    expect(serverMock.to().emit).toHaveBeenCalledWith('message', { ...message, user: { username: 'testuser' } });
  });
});
