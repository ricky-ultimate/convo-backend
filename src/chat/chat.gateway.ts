import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { AuthService } from '../auth/auth.service';
import { Logger } from '@nestjs/common';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({ path: '/ws', cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('ChatGateway');
  private rateLimiter: RateLimiterRedis;

  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const redisClient = this.redisService.getClient();
    const rateLimitPoints = this.configService.get<number>(
      'RATE_LIMIT_POINTS',
      5,
    );
    const rateLimitDuration = this.configService.get<number>(
      'RATE_LIMIT_DURATION',
      10,
    );

    this.rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      points: rateLimitPoints,
      duration: rateLimitDuration,
    });
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket server initialized');
  }

  async handleConnection(socket: Socket) {
    const token = socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) {
      this.logger.error(
        `No token provided. Disconnecting socket: ${socket.id}`,
      );
      socket.disconnect();
      return;
    }

    try {
      const decoded = this.jwtService.verify(token);
      socket.data.user = decoded;
      this.logger.log(
        `Client connected: ${socket.id} with user ${decoded.username}`,
      );
    } catch (err) {
      this.logger.error(`Invalid token for socket: ${socket.id}`);
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(socket: Socket, data: { roomId: string }) {
    const { roomId } = data;
    const username = socket.data.user.username;

    if (!roomId || !username) {
      const errorMsg = 'Room ID or Username is missing.';
      this.logger.error(errorMsg);
      socket.emit('error', { message: errorMsg, code: 'INVALID_REQUEST' });
      return;
    }

    try {
      const isMember = await this.chatService.isUserInRoom(roomId, username);
      if (!isMember) {
        const errorMsg = `User ${username} is not a member of room ${roomId}`;
        this.logger.error(errorMsg);
        socket.emit('error', {
          message: 'You are not a member of this room.',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      socket.join(roomId);
      this.server.to(roomId).emit('userJoined', { username, roomId });
      this.logger.log(`User ${username} joined room ${roomId}`);

      await this.authService.extendSessionTTL(socket.data.user.sub);
    } catch (error) {
      this.logger.error(`Error joining room ${roomId}: ${error.message}`);
      socket.emit('error', {
        message: 'An error occurred while joining the room.',
        code: 'SERVER_ERROR',
      });
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(socket: Socket, data: { roomId: string }) {
    const { roomId } = data;
    const username = socket.data.user.username;

    if (!roomId || !username) {
      const errorMsg = 'Room ID or Username is missing.';
      this.logger.error(errorMsg);
      socket.emit('error', { message: errorMsg, code: 'INVALID_REQUEST' });
      return;
    }

    try {
      socket.leave(roomId);
      this.server.to(roomId).emit('userLeft', { username, roomId });
      this.logger.log(`User ${username} left room ${roomId}`);

      await this.authService.extendSessionTTL(socket.data.user.sub);
    } catch (error) {
      this.logger.error(`Error leaving room ${roomId}: ${error.message}`);
      socket.emit('error', {
        message: 'An error occurred while leaving the room.',
        code: 'SERVER_ERROR',
      });
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    socket: Socket,
    data: { roomId: string; content: string },
  ) {
    const { roomId, content } = data;
    const username = socket.data.user.username;

    if (!roomId || !username || !content) {
      const errorMsg = 'Room ID, Username or Message content is missing.';
      this.logger.error(errorMsg);
      await socket.emit('error', {
        message: errorMsg,
        code: 'INVALID_REQUEST',
      });
      return;
    }

    if (content.trim().length === 0) {
      const errorMsg = 'Message content cannot be empty.';
      this.logger.error(errorMsg);
      await socket.emit('error', {
        message: errorMsg,
        code: 'INVALID_REQUEST',
      });
      return;
    }

    if (content.length > 1000) {
      const errorMsg = 'Message content must be less than 1000 characters.';
      this.logger.error(errorMsg);
      await socket.emit('error', {
        message: errorMsg,
        code: 'INVALID_REQUEST',
      });
      return;
    }

    try {
      await this.rateLimiter.consume(socket.id);
    } catch (rateLimiterRes) {
      this.logger.error(`Rate limit exceeded for socket: ${socket.id}`);
      await socket.emit('error', {
        message: 'Rate limit exceeded. Please slow down.',
        code: 'RATE_LIMIT',
      });
      return;
    }

    try {
      const isMember = await this.chatService.isUserInRoom(roomId, username);
      if (!isMember) {
        const errorMsg = `User ${username} is not a member of room ${roomId}`;
        this.logger.error(errorMsg);
        await socket.emit('error', {
          message: 'You are not a member of this room.',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const sanitizedContent = content
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .trim();

      const message = await this.chatService.addMessage(
        roomId,
        sanitizedContent,
        username,
      );

      if (!message) {
        throw new Error('Failed to save message.');
      }

      this.server
        .to(roomId)
        .emit('message', {
          ...message,
          user: { username: message.user.username },
        });

      await this.authService.extendSessionTTL(socket.data.user.sub);

      this.logger.log(`Message sent by ${username} in room ${roomId}`);
    } catch (error) {
      this.logger.error(
        `Failed to save message from ${username} in room ${roomId}: ${error.message}`,
      );
      await socket.emit('error', {
        message: 'Failed to send message.',
        code: 'SERVER_ERROR',
      });
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    socket: Socket,
    data: { roomId: string; messageId: string },
  ) {
    const { roomId, messageId } = data;
    const username = socket.data.user.username;

    if (!roomId || !messageId) {
      const errorMsg = 'Room ID or Message ID is missing.';
      this.logger.error(errorMsg);
      socket.emit('error', { message: errorMsg, code: 'INVALID_REQUEST' });
      return;
    }

    try {
      const isMember = await this.chatService.isUserInRoom(roomId, username);
      if (!isMember) {
        const errorMsg = `User ${username} is not a member of room ${roomId}`;
        this.logger.error(errorMsg);
        socket.emit('error', {
          message: 'You are not a member of this room.',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      await this.chatService.deleteMessage(messageId, roomId);

      const updatedMessages = await this.chatService.getMessages(roomId);
      this.server.to(roomId).emit('messagesUpdated', updatedMessages);

      this.logger.log(
        `Message ${messageId} deleted by ${username} in room ${roomId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete message in room ${roomId}: ${error.message}`,
      );
      socket.emit('error', {
        message: 'Failed to delete message.',
        code: 'SERVER_ERROR',
      });
    }
  }

  @SubscribeMessage('getRoomMembers')
  async handleGetRoomMembers(socket: Socket, data: { roomId: string }) {
    const { roomId } = data;
    const username = socket.data.user.username;

    if (!roomId) {
      const errorMsg = 'Room ID is missing.';
      this.logger.error(errorMsg);
      socket.emit('error', { message: errorMsg, code: 'INVALID_REQUEST' });
      return;
    }

    try {
      const isMember = await this.chatService.isUserInRoom(roomId, username);
      if (!isMember) {
        const errorMsg = `User ${username} is not a member of room ${roomId}`;
        this.logger.error(errorMsg);
        socket.emit('error', {
          message: 'You are not a member of this room.',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const members = await this.chatService.getRoomMembers(roomId);
      socket.emit('roomMembers', { roomId, members });

      this.logger.log(
        `Room members retrieved for room ${roomId} by ${username}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get room members for room ${roomId}: ${error.message}`,
      );
      socket.emit('error', {
        message: 'Failed to retrieve room members.',
        code: 'SERVER_ERROR',
      });
    }
  }
}
