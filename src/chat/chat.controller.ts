import { Controller, Get, Post, Body, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('room')
  createRoom(@Body('name') name: string) {
    return this.chatService.createChatRoom(name);
  }

  @Post('message')
  addMessage(
    @Body('chatRoomName') chatRoomName: string,
    @Body('content') content: string,
    @Body('username') username: string,
  ) {
    return this.chatService.addMessage(chatRoomName, content, username);
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages')
  async getMessages(
    @Query('chatRoomName') chatRoomName: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const user = request.user;

    // Check if the user is a member of the room
    const isMember = await this.chatService.isUserInRoom(chatRoomName, user.username);

    if (!isMember) {
      throw new UnauthorizedException('You are not a member of this room.');
    }

    return this.chatService.getMessages(chatRoomName);
  }
}
