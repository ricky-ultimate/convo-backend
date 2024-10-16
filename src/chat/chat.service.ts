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

  // Cache recent messages in Redis with fallback to continue without Redis
  async cacheMessages(roomId: string, messages: any[]) {
    const key = `chat:room:${roomId}:messages`; // Redis key for storing messages
    try {
      await this.redisClient.set(key, JSON.stringify(messages), 'EX', 60 * 10); // Cache for 10 minutes
      this.logger.log(`Cached messages for room: ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to cache messages in Redis for room ${roomId}: ${error.message}`);
    }
  }

  // Fetch cached messages from Redis with fallback to DB
  async getCachedMessages(roomId: string): Promise<any[]> {
    const key = `chat:room:${roomId}:messages`;

    try {
      const cachedMessages = await this.redisClient.get(key);
      if (cachedMessages) {
        this.logger.log(`Cache hit for room: ${roomId}`);
        return JSON.parse(cachedMessages);
      } else {
        this.logger.warn(`Cache miss for room: ${roomId}`);
        return null;
      }
    } catch (error) {
      // Log Redis failure and fall back to fetching from DB
      this.logger.error(`Failed to fetch messages from Redis for room ${roomId}: ${error.message}`);
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
      include: { user: true },  // Include user data when saving the message
    });

    // Fetch cached recent messages and add the new one
    const recentMessages = await this.getCachedMessages(chatRoom.id.toString());
    const updatedMessages = recentMessages ? [...recentMessages, message] : [message];

    // Cache updated messages
    await this.cacheMessages(chatRoom.id.toString(), updatedMessages);

    return {
      ...message,
      user: { username: user.username },  // Explicitly return the user object with the username
    };
  }


  // Fetch messages from DB with fallback if Redis is down
  async getMessages(chatRoomName: string) {
    const chatRoom = await this.prisma.chatRoom.findUnique({ where: { name: chatRoomName } });

    // Check cache first, fall back to DB if Redis fails
    const cachedMessages = await this.getCachedMessages(chatRoom.id.toString());
    if (cachedMessages && cachedMessages.length > 0) {
      this.logger.log(`Returning cached messages for room: ${chatRoom.id}`);

      // Ensure cached messages contain user data
      return cachedMessages.map(message => ({
        ...message,
        user: { username: message.user.username || 'Anonymous' }
      }));
    }

    // If not cached, fetch from DB
    const messages = await this.prisma.message.findMany({
      where: { chatRoomId: chatRoom.id },
      include: { user: true },
    });

    const validMessages = messages.filter((msg) => msg.user);

    // Cache fetched messages for future requests
    await this.cacheMessages(chatRoom.id.toString(), validMessages);

    return validMessages.map(message => ({
      ...message,
      user: { username: message.user.username }
    }));
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
