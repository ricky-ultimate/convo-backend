import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ChatService } from './chat.service';

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

  @Get('messages')
  getMessages(@Query('chatRoomName') chatRoomName: string) {
    return this.chatService.getMessages(chatRoomName);
  }
}
