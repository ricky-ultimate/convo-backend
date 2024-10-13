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
  import { Logger } from '@nestjs/common';
  import { RateLimiterRedis } from 'rate-limiter-flexible';
  import { JwtService } from '@nestjs/jwt';
  import { ConfigService } from '@nestjs/config';
  import { Redis } from 'ioredis';

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
      private readonly jwtService: JwtService,
      private readonly configService: ConfigService, // Fixed typo here
    ) {
      // Initialize Redis client for rate limiting
      const redisClient = new Redis(this.configService.get<string>('REDIS_URL'));

        // Read rate limit settings from env
      const rateLimitPoints = this.configService.get<number>('RATE_LIMIT_POINTS', 5);
      const rateLimitDuration = this.configService.get<number>('RATE_LIMIT_DURATION', 10);

      // Proper instantiation of Redis-based rate limiter
      this.rateLimiter = new RateLimiterRedis({
        storeClient: redisClient,
        points: rateLimitPoints, // 5 messages
        duration: rateLimitDuration, // per 10 seconds
      });
    }

    afterInit(server: Server) {
      this.logger.log('WebSocket server initialized');
    }

    async handleConnection(socket: Socket) {
      const token = socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        this.logger.error(`No token provided. Disconnecting socket: ${socket.id}`);
        socket.disconnect();
        return;
      }

      try {
        const decoded = this.jwtService.verify(token);
        socket.data.user = decoded;
        this.logger.log(`Client connected: ${socket.id} with user ${decoded.username}`);
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
        this.logger.error(`Room ID or Username is missing for socket: ${socket.id}`);
        socket.emit('error', 'Room ID or Username is missing.');
        return;
      }

      const isMember = await this.chatService.isUserInRoom(roomId, username);
      if (!isMember) {
        this.logger.error(`User ${username} is not a member of room ${roomId}`);
        socket.emit('error', 'You are not a member of this room.');
        return;
      }

      socket.join(roomId);
      this.server.to(roomId).emit('userJoined', { username, roomId });
      this.logger.log(`User ${username} joined room ${roomId}`);
    }

    @SubscribeMessage('message')
    async handleMessage(socket: Socket, data: { roomId: string; content: string }) {
      const { roomId, content } = data;
      const username = socket.data.user.username;

      if (!roomId || !username) {
        this.logger.error(`Room ID or Username is missing for socket: ${socket.id}`);
        await socket.emit('error', 'Room ID or Username is missing.');
        return;
      }

      try {
        const isMember = await this.chatService.isUserInRoom(roomId, username);
        if (!isMember) {
          this.logger.error(`User ${username} is not a member of room ${roomId}`);
          await socket.emit('error', 'You are not a member of this room.');
          return;
        }

        // Properly consume rate limit
        await this.rateLimiter.consume(socket.id);
      } catch (rateLimiterRes) {
        await socket.emit('error', 'Rate limit exceeded. Please slow down.');
        this.logger.error('Rate Limit exceeded, please slow down');
        throw new Error('Rate limit exceeded');  // Propagate the error correctly
      }

      this.logger.log(`Message from ${username} in room ${roomId}: ${content}`);

      const sanitizedContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const message = await this.chatService.addMessage(roomId, sanitizedContent, username);

      if (!message) {
        this.logger.error(`Failed to save message from ${username} in room ${roomId}`);
        await socket.emit('error', 'Failed to save message.');
        return;
      }

      this.server.to(roomId).emit('message', { ...message, user: { username } });
    }

  }
