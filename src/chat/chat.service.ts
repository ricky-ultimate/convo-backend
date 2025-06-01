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
      return await this.prisma.chatRoom.create({ data: { name: name.trim() } });
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

  async addMessage(roomId: string, content: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
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
        include: { user: { select: { username: true, id: true } } },
      });

      return newMessage;
    });

    const cachedMessages = await this.getCachedMessages(roomId);
    const updatedMessages = cachedMessages
      ? [...cachedMessages, message]
      : [message];

    const messagesToCache = updatedMessages.slice(-50);
    await this.cacheMessages(roomId, messagesToCache);

    return { ...message, user: { username: user.username } };
  }

  async getMessages(
    roomId: string,
    page = 1,
    limit = 50,
    requestingUserId: string,
  ) {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!chatRoom) {
      throw new BadRequestException('Chat room not found');
    }

    if (page === 1) {
      const cachedMessages = await this.getCachedMessages(roomId);
      if (cachedMessages && cachedMessages.length > 0) {
        this.logger.log(`Returning cached messages for room: ${roomId}`);
        return cachedMessages.map((message) => ({
          ...message,
          user: { username: message.user.username },
          canDelete: requestingUserId
            ? message.userId === requestingUserId
            : false,
        }));
      }
    }

    const messages = await this.prisma.message.findMany({
      where: { chatRoomId: chatRoom.id },
      include: { user: { select: { username: true, id: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const validMessages = messages.filter((msg) => msg.user);
    const reversedMessages = validMessages.reverse();

    if (page === 1) {
      await this.cacheMessages(roomId, reversedMessages);
    }

    return reversedMessages.map((message) => ({
      ...message,
      user: { username: message.user.username },
      canDelete: requestingUserId ? message.userId === requestingUserId : false,
    }));
  }

  async deleteMessage(messageId: string, roomId: string, userId: string) {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!chatRoom) {
      throw new BadRequestException('Chat room not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.findUnique({
        where: { id: messageId },
        include: { user: { select: { id: true, username: true } } },
      });

      if (!message) {
        throw new BadRequestException('Message not found');
      }

      if (message.chatRoomId !== chatRoom.id) {
        throw new BadRequestException('Message does not belong to this room');
      }

      if (message.userId !== userId) {
        this.logger.warn(
          `Unauthorized deletion attempt: User ID ${userId} tried to delete message owned by ${message.userId}`,
        );
        throw new BadRequestException(
          'You are not authorized to delete this message. You can only delete your own messages.',
        );
      }

      await tx.message.delete({ where: { id: messageId } });

      this.logger.log(
        `Message ${messageId} deleted by owner (User ID: ${message.userId}) in room: ${roomId}`,
      );
    });

    const cacheKey = `chat:room:${roomId}:messages`;
    await this.redisService.del(cacheKey);

    this.logger.log(
      `Deleted message ${messageId} and invalidated cache for room: ${roomId}`,
    );
  }

  async isUserInRoom(roomId: string, userId: string): Promise<boolean> {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!chatRoom) {
      return false;
    }

    const membership = await this.prisma.chatRoomMembership.findFirst({
      where: { chatRoomId: chatRoom.id, userId: userId },
    });
    return !!membership;
  }

  async joinRoom(roomId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!chatRoom) {
      throw new BadRequestException('Room not found');
    }

    const existingMembership = await this.prisma.chatRoomMembership.findFirst({
      where: { chatRoomId: chatRoom.id, userId: user.id },
    });

    if (existingMembership) {
      throw new BadRequestException('You are already a member of this room');
    }

    const membership = await this.prisma.chatRoomMembership.create({
      data: { chatRoomId: chatRoom.id, userId: user.id },
      include: {
        chatRoom: { select: { id: true, name: true, createdAt: true } },
      },
    });

    this.logger.log(
      `User ${user.username} (ID: ${userId}) joined room ${chatRoom.name} (ID: ${roomId})`,
    );

    return { message: 'Successfully joined room', room: membership.chatRoom };
  }

  async getUserRooms(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const memberships = await this.prisma.chatRoomMembership.findMany({
      where: { userId: user.id },
      include: {
        chatRoom: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            _count: { select: { messages: true, memberships: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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

  async leaveRoom(roomId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!chatRoom) {
      throw new BadRequestException('Room not found');
    }

    const membership = await this.prisma.chatRoomMembership.findFirst({
      where: { chatRoomId: chatRoom.id, userId: user.id },
    });

    if (!membership) {
      throw new BadRequestException('You are not a member of this room');
    }

    await this.prisma.chatRoomMembership.delete({
      where: { id: membership.id },
    });

    this.logger.log(
      `User ${user.username} (ID: ${userId}) left room ${chatRoom.name} (ID: ${roomId})`,
    );

    return { message: 'Successfully left room' };
  }

  async getRoomMembers(roomId: string) {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!chatRoom) {
      throw new BadRequestException('Room not found');
    }

    const memberships = await this.prisma.chatRoomMembership.findMany({
      where: { chatRoomId: chatRoom.id },
      include: { user: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => ({
      userId: membership.user.id,
      username: membership.user.username,
      joinedAt: membership.createdAt,
    }));
  }

  async getRoomInfo(roomId: string) {
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { messages: true, memberships: true } },
      },
    });

    if (!chatRoom) {
      throw new BadRequestException('Room not found');
    }

    return {
      id: chatRoom.id,
      name: chatRoom.name,
      createdAt: chatRoom.createdAt,
      messageCount: chatRoom._count.messages,
      memberCount: chatRoom._count.memberships,
    };
  }
}
