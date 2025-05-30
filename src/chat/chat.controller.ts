import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UnauthorizedException,
  UseGuards,
  InternalServerErrorException,
  BadRequestException,
  Param,
  Query,
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
      const room = await this.chatService.createChatRoom(name.trim());
      await this.chatService.joinRoom(room.id, request.user.username);
      return room;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Room name already exists');
      }
      throw new InternalServerErrorException('Failed to create room');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('room/:roomId/message')
  async addMessage(
    @Param('roomId') roomId: string,
    @Body() sendMessageDto: SendMessageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const { content } = sendMessageDto;
    const username = request.user.username;

    if (!roomId || !content) {
      throw new BadRequestException('Room ID and content are required');
    }

    if (content.length > 1000) {
      throw new BadRequestException(
        'Message content must be less than 1000 characters',
      );
    }

    try {
      const isMember = await this.chatService.isUserInRoom(roomId, username);
      if (!isMember) {
        throw new UnauthorizedException('You are not a member of this room');
      }

      return await this.chatService.addMessage(
        roomId,
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
  @Get('room/:roomId/messages')
  async getMessages(
    @Param('roomId') roomId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Req() request: AuthenticatedRequest,
  ) {
    const user = request.user;

    if (!roomId) {
      throw new BadRequestException('Room ID is required');
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    try {
      const isMember = await this.chatService.isUserInRoom(
        roomId,
        user.username,
      );
      if (!isMember) {
        throw new UnauthorizedException('You are not a member of this room');
      }

      return await this.chatService.getMessages(roomId, pageNum, limitNum);
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
  @Get('rooms')
  async getUserRooms(@Req() request: AuthenticatedRequest) {
    const username = request.user.username;

    try {
      return await this.chatService.getUserRooms(username);
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve rooms');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('room/:roomId')
  async getRoomInfo(
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

      return await this.chatService.getRoomInfo(roomId);
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve room info');
    }
  }
}
