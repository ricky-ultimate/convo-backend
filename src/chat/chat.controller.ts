import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
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

    try {
      const isMember = await this.chatService.isUserInRoom(
        chatRoomName,
        user.username,
      );
      if (!isMember) {
        throw new UnauthorizedException('You are not a member of this room.');
      }

      return await this.chatService.getMessages(chatRoomName);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error; // Bubble up specific error
      }
      throw new InternalServerErrorException(
        'An error occurred while retrieving messages.',
      );
    }
  }
}
