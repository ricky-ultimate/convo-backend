import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
  private redisClient: Redis;
  private readonly logger = new Logger(ChatService.name); // Logger instance for tracking

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService, // ConfigService for Redis URL
  ) {
    // Initialize Redis client using URL from config (e.g., .env)
    this.redisClient = new Redis(this.configService.get<string>('REDIS_URL'));
  }

  // Method to create a new chat room
  async createChatRoom(name: string) {
    return this.prisma.chatRoom.create({
      data: { name },
    });
  }

  // Cache recent messages in Redis
  async cacheMessages(roomId: string, messages: any[]) {
    const key = `chat:room:${roomId}:messages`; // Redis key for storing messages
    await this.redisClient.set(key, JSON.stringify(messages), 'EX', 60 * 10); // Cache for 10 minutes
    this.logger.log(`Cached messages for room: ${roomId}`); // Log caching
  }

  // Fetch cached messages from Redis
  async getCachedMessages(roomId: string): Promise<any[]> {
    const key = `chat:room:${roomId}:messages`;
    const cachedMessages = await this.redisClient.get(key);

    if (cachedMessages) {
      this.logger.log(`Cache hit for room: ${roomId}`); // Log cache hit
      return JSON.parse(cachedMessages);
    } else {
      this.logger.warn(`Cache miss for room: ${roomId}`); // Log cache miss
      return null;
    }
  }

  // Method to add a message and cache recent ones in Redis
  async addMessage(chatRoomName: string, content: string, username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    const chatRoom = await this.prisma.chatRoom.findUnique({ where: { name: chatRoomName } });

    if (!user || !chatRoom) throw new Error('User or chat room not found.');

    const message = await this.prisma.message.create({
      data: {
        content,
        userId: user.id,
        chatRoomId: chatRoom.id,
      },
    });

    // Fetch cached recent messages and add the new one
    const recentMessages = await this.getCachedMessages(chatRoom.id.toString());
    const updatedMessages = recentMessages ? [...recentMessages, message] : [message];

    // Cache updated messages
    await this.cacheMessages(chatRoom.id.toString(), updatedMessages);

    return message;
  }

  // Fetch messages from DB and cache them
  async getMessages(chatRoomName: string) {
    const chatRoom = await this.prisma.chatRoom.findUnique({ where: { name: chatRoomName } });

    // Check cache first
    const cachedMessages = await this.getCachedMessages(chatRoom.id.toString());
    if (cachedMessages && cachedMessages.length > 0) {
      this.logger.log(`Returning cached messages for room: ${chatRoom.id}`);
      return cachedMessages; // Return cached messages if available
    }

    // If not cached, fetch from DB
    const messages = await this.prisma.message.findMany({
      where: { chatRoomId: chatRoom.id },
      include: { user: true },
    });

    const validMessages = messages.filter(msg => msg.user);

    // Cache fetched messages for future requests
    await this.cacheMessages(chatRoom.id.toString(), validMessages);
    this.logger.log(`Fetched messages from DB and cached them for room: ${chatRoom.id}`);

    return messages;
  }

  // Check if the user is in the room
  async isUserInRoom(roomId: string, username: string): Promise<boolean> {
    const membership = await this.prisma.chatRoomMembership.findFirst({
      where: {
        chatRoom: { name: roomId },
        user: { username },
      },
    });
    return !!membership; // Return true if membership exists
  }
}
