import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async createChatRoom(name: string) {
    return this.prisma.chatRoom.create({
      data: { name },
    });
  }

  async addMessage(chatRoomName: string, content: string, username: string) {
    // Check if the user exists
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new Error(`User with username "${username}" not found`);
    }

    // Check if the chat room exists
    const chatRoom = await this.prisma.chatRoom.findUnique({ where: { name: chatRoomName } });
    if (!chatRoom) {
      throw new Error(`Chat room "${chatRoomName}" not found`);
    }

    // Create the message
    return this.prisma.message.create({
      data: {
        content,
        userId: user.id,
        chatRoomId: chatRoom.id,
      },
    });
  }


  async getMessages(chatRoomName: string) {
    const chatRoom = await this.prisma.chatRoom.findUnique({ where: { name: chatRoomName } });
    return this.prisma.message.findMany({
      where: { chatRoomId: chatRoom.id },
      include: { user: true },
    });
  }
}
