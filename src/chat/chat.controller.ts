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
  BadRequestException,
  Param,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types';
import { CreateRoomDto } from './dto/create-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { GetMessagesDto } from './dto/get-message.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(JwtAuthGuard)
  @Post('room')
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const { name } = createRoomDto;
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Room name is required');
    }

    if (name.length > 50) {
      throw new BadRequestException(
        'Room name must be less than 50 characters',
      );
    }

    try {
      return await this.chatService.createChatRoom(name.trim());
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Room name already exists');
      }
      throw new InternalServerErrorException('Failed to create room');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('message')
  async addMessage(
    @Body() sendMessageDto: SendMessageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const { chatRoomName, content } = sendMessageDto;
    const username = request.user.username;

    if (!chatRoomName || !content) {
      throw new BadRequestException('Chat room name and content are required');
    }

    if (content.length > 1000) {
      throw new BadRequestException(
        'Message content must be less than 1000 characters',
      );
    }

    try {
      const isMember = await this.chatService.isUserInRoom(
        chatRoomName,
        username,
      );
      if (!isMember) {
        throw new UnauthorizedException('You are not a member of this room');
      }

      return await this.chatService.addMessage(
        chatRoomName,
        content.trim(),
        username,
      );
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to send message');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages')
  async getMessages(
    @Query() getMessagesDto: GetMessagesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const { chatRoomName } = getMessagesDto;
    const user = request.user;

    if (!chatRoomName) {
      throw new BadRequestException('Chat room name is required');
    }

    try {
      const isMember = await this.chatService.isUserInRoom(
        chatRoomName,
        user.username,
      );
      if (!isMember) {
        throw new UnauthorizedException('You are not a member of this room');
      }

      return await this.chatService.getMessages(chatRoomName);
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An error occurred while retrieving messages',
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('join')
  async joinRoom(
    @Body() joinRoomDto: JoinRoomDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const username = request.user.username;
    const { roomId } = joinRoomDto;

    if (!roomId) {
      throw new BadRequestException('Room ID is required');
    }

    try {
      return await this.chatService.joinRoom(roomId, username);
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new BadRequestException('Room not found');
      }
      if (error.message.includes('already a member')) {
        throw new BadRequestException('You are already a member of this room');
      }
      throw new InternalServerErrorException('Failed to join room');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('leave/:roomId')
  async leaveRoom(
    @Param('roomId') roomId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const username = request.user.username;

    if (!roomId) {
      throw new BadRequestException('Room ID is required');
    }

    try {
      return await this.chatService.leaveRoom(roomId, username);
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new BadRequestException('Room not found');
      }
      if (error.message.includes('not a member')) {
        throw new BadRequestException('You are not a member of this room');
      }
      throw new InternalServerErrorException('Failed to leave room');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('room/:roomId/members')
  async getRoomMembers(
    @Param('roomId') roomId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!roomId) {
      throw new BadRequestException('Room ID is required');
    }

    try {
      const isMember = await this.chatService.isUserInRoom(
        roomId,
        request.user.username,
      );
      if (!isMember) {
        throw new UnauthorizedException('You are not a member of this room');
      }

      return await this.chatService.getRoomMembers(roomId);
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve room members');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('room/:roomId/messages')
  async getMessagesByRoomId(
    @Param('roomId') roomId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!roomId) {
      throw new BadRequestException('Room ID is required');
    }

    try {
      const isMember = await this.chatService.isUserInRoom(
        roomId,
        request.user.username,
      );
      if (!isMember) {
        throw new UnauthorizedException('You are not a member of this room');
      }

      return await this.chatService.getMessages(roomId);
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An error occurred while retrieving messages',
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('rooms')
  async getUserRooms(@Req() request: AuthenticatedRequest) {
    const username = request.user.username;

    try {
      return await this.chatService.getUserRooms(username);
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve rooms');
    }
  }
}
