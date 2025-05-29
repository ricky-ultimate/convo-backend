import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async createChatRoom(name: string) {
    try {
      return await this.prisma.chatRoom.create({
        data: { name: name.trim() },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Room name already exists');
      }
      throw error;
    }
  }

  async cacheMessages(roomId: string, messages: any[]): Promise<void> {
    const key = `chat:room:${roomId}:messages`;
    const cached = await this.redisService.set(
      key,
      JSON.stringify(messages),
      60 * 10,
    );

    if (cached) {
      this.logger.log(`Cached messages for room: ${roomId}`);
    } else {
      this.logger.warn(`Failed to cache messages for room ${roomId}`);
    }
  }

  async getCachedMessages(roomId: string): Promise<any[] | null> {
    const key = `chat:room:${roomId}:messages`;
    const cachedMessages = await this.redisService.get(key);

    if (cachedMessages) {
      try {
        this.logger.log(`Cache hit for room: ${roomId}`);
        return JSON.parse(cachedMessages);
      } catch (error) {
        this.logger.error(
          `Failed to parse cached messages for room ${roomId}: ${error.message}`,
        );
        await this.redisService.del(key);
        return null;
      }
    }

    this.logger.log(`Cache miss for room: ${roomId}`);
    return null;
  }

  async addMessage(chatRoomName: string, content: string, username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { name: chatRoomName },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!chatRoom) {
      throw new BadRequestException('Chat room not found');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const newMessage = await tx.message.create({
        data: {
          content: content.trim(),
          userId: user.id,
          chatRoomId: chatRoom.id,
        },
        include: {
          user: {
            select: {
              username: true,
              id: true,
            },
          },
        },
      });

      return newMessage;
    });

    const cachedMessages = await this.getCachedMessages(chatRoom.id.toString());
    const updatedMessages = cachedMessages
      ? [...cachedMessages, message]
      : [message];

    const messagesToCache = updatedMessages.slice(-50);
    await this.cacheMessages(chatRoom.id.toString(), messagesToCache);

    return {
      ...message,
      user: { username: user.username },
    };
  }

  async getMessages(chatRoomName: string, page = 1, limit = 50) {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { name: chatRoomName },
    });

    if (!chatRoom) {
      throw new BadRequestException('Chat room not found');
    }

    if (page === 1) {
      const cachedMessages = await this.getCachedMessages(
        chatRoom.id.toString(),
      );
      if (cachedMessages && cachedMessages.length > 0) {
        this.logger.log(`Returning cached messages for room: ${chatRoom.id}`);
        return cachedMessages.map((message) => ({
          ...message,
          user: { username: message.user?.username || 'Anonymous' },
        }));
      }
    }

    const messages = await this.prisma.message.findMany({
      where: { chatRoomId: chatRoom.id },
      include: {
        user: {
          select: {
            username: true,
            id: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const validMessages = messages.filter((msg) => msg.user);
    const reversedMessages = validMessages.reverse();

    if (page === 1) {
      await this.cacheMessages(chatRoom.id.toString(), reversedMessages);
    }

    return reversedMessages.map((message) => ({
      ...message,
      user: { username: message.user.username },
    }));
  }

  async deleteMessage(messageId: string, chatRoomName: string) {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { name: chatRoomName },
    });

    if (!chatRoom) {
      throw new BadRequestException('Chat room not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.findUnique({
        where: { id: messageId },
        include: { user: true },
      });

      if (!message) {
        throw new BadRequestException('Message not found');
      }

      if (message.chatRoomId !== chatRoom.id) {
        throw new BadRequestException('Message does not belong to this room');
      }

      await tx.message.delete({
        where: { id: messageId },
      });
    });

    const cacheKey = `chat:room:${chatRoom.id}:messages`;
    await this.redisService.del(cacheKey);

    this.logger.log(
      `Deleted message ${messageId} and invalidated cache for room: ${chatRoomName}`,
    );
  }

  async isUserInRoom(roomName: string, username: string): Promise<boolean> {
    const membership = await this.prisma.chatRoomMembership.findFirst({
      where: {
        chatRoom: { name: roomName },
        user: { username },
      },
    });
    return !!membership;
  }

  async joinRoom(roomName: string, username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { name: roomName },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!chatRoom) {
      throw new BadRequestException('Room not found');
    }

    // Check if user is already a member
    const existingMembership = await this.prisma.chatRoomMembership.findFirst({
      where: {
        chatRoomId: chatRoom.id,
        userId: user.id,
      },
    });

    if (existingMembership) {
      throw new BadRequestException('You are already a member of this room');
    }

    // Create membership
    const membership = await this.prisma.chatRoomMembership.create({
      data: {
        chatRoomId: chatRoom.id,
        userId: user.id,
      },
      include: {
        chatRoom: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        },
      },
    });

    this.logger.log(`User ${username} joined room ${roomName}`);

    return {
      message: 'Successfully joined room',
      room: membership.chatRoom,
    };
  }

  async getUserRooms(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const memberships = await this.prisma.chatRoomMembership.findMany({
      where: {
        userId: user.id,
      },
      include: {
        chatRoom: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            _count: {
              select: {
                messages: true,
                memberships: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return memberships.map((membership) => ({
      id: membership.chatRoom.id,
      name: membership.chatRoom.name,
      createdAt: membership.chatRoom.createdAt,
      joinedAt: membership.createdAt,
      messageCount: membership.chatRoom._count.messages,
      memberCount: membership.chatRoom._count.memberships,
    }));
  }

  async leaveRoom(roomName: string, username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { name: roomName },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!chatRoom) {
      throw new BadRequestException('Room not found');
    }

    const membership = await this.prisma.chatRoomMembership.findFirst({
      where: {
        chatRoomId: chatRoom.id,
        userId: user.id,
      },
    });

    if (!membership) {
      throw new BadRequestException('You are not a member of this room');
    }

    await this.prisma.chatRoomMembership.delete({
      where: {
        id: membership.id,
      },
    });

    this.logger.log(`User ${username} left room ${roomName}`);

    return {
      message: 'Successfully left room',
    };
  }

  async getRoomMembers(roomName: string) {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { name: roomName },
    });

    if (!chatRoom) {
      throw new BadRequestException('Room not found');
    }

    const memberships = await this.prisma.chatRoomMembership.findMany({
      where: {
        chatRoomId: chatRoom.id,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return memberships.map((membership) => ({
      username: membership.user.username,
      joinedAt: membership.createdAt,
    }));
  }
}
