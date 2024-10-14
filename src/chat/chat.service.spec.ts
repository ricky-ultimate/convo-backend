import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis-mock';

describe('ChatService', () => {
  let chatService: ChatService;
  let redisClient: InstanceType<typeof Redis>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PrismaService,
          useValue: {
            // Mock implementation of PrismaService methods
            chatRoom: {
              create: jest.fn(),
              findUnique: jest.fn(),
            },
            message: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(), // Mock implementation of ConfigService
          },
        },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);

    // Mock Redis instance
    redisClient = new Redis();
    (chatService as any).redisClient = redisClient;
  });

  it('should cache messages in Redis', async () => {
    const messages = [
      {
        id: 1,
        content: 'Hello',
        userId: 1,
        chatRoomId: 1,
        createdAt: new Date(),
        user: { username: 'testuser' },
      },
    ];
    await chatService.cacheMessages('room-1', messages);

    const cachedMessages = await redisClient.get('chat:room:room-1:messages');
    expect(cachedMessages).toBe(JSON.stringify(messages));
  });

  it('should fallback to continue without Redis if Redis fails during caching', async () => {
    const messages = [
      {
        id: 1,
        content: 'Hello',
        userId: 1,
        chatRoomId: 1,
        createdAt: new Date(),
        user: { username: 'testuser' },
      },
    ];
    jest
      .spyOn(redisClient, 'set')
      .mockRejectedValue(new Error('Redis unavailable'));

    // Should proceed without throwing an error even if Redis fails
    await expect(
      chatService.cacheMessages('room-1', messages),
    ).resolves.not.toThrow();
  });

  it('should fetch messages from Redis', async () => {
    const messages = [
      {
        id: 1,
        content: 'Hello',
        userId: 1,
        chatRoomId: 1,
        createdAt: new Date(),
        user: { username: 'testuser' },
      },
    ];
    await redisClient.set(
      'chat:room:room-1:messages',
      JSON.stringify(messages),
    );

    const result = await chatService.getCachedMessages('room-1');

    // Instead of comparing the full objects, we will compare individual properties
    expect(result[0].id).toBe(messages[0].id);
    expect(result[0].content).toBe(messages[0].content);
    expect(result[0].userId).toBe(messages[0].userId);
    expect(result[0].chatRoomId).toBe(messages[0].chatRoomId);
    expect(new Date(result[0].createdAt)).toEqual(messages[0].createdAt);
  });

  it('should fallback to DB if Redis is down during fetch', async () => {
    jest
      .spyOn(redisClient, 'get')
      .mockRejectedValue(new Error('Redis unavailable'));

    const mockChatRoom = { id: 1, name: 'room-1', createdAt: new Date() }; // Mock chat room
    jest
      .spyOn(chatService['prisma'].chatRoom, 'findUnique')
      .mockResolvedValue(mockChatRoom); // Mock the chatRoom

    const mockMessages = [
      {
        id: 1,
        content: 'Hello from DB',
        userId: 1,
        chatRoomId: 1,
        createdAt: new Date(),
        user: { username: 'testuser' },
      },
    ];
    jest
      .spyOn(chatService['prisma'].message, 'findMany')
      .mockResolvedValue(mockMessages);

    const result = await chatService.getMessages('room-1');

    // Ensure it fetches from DB as a fallback
    expect(result).toEqual(mockMessages);
  });
});
