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
  import { RateLimiterMemory } from 'rate-limiter-flexible';

  @WebSocketGateway({ path: '/ws', cors: { origin: '*' } })
  export class ChatGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
  {
    @WebSocketServer()
    server: Server;

    private logger: Logger = new Logger('ChatGateway');

    // Rate limiter to avoid message spamming
    private rateLimiter = new RateLimiterMemory({
      points: 5, // 5 messages
      duration: 10, // per 10 seconds
    });

    constructor(private readonly chatService: ChatService) {}

    afterInit(server: Server) {
      this.logger.log('WebSocket server initialized');
    }

    async handleConnection(socket: Socket) {
      this.logger.log(`Client connected: ${socket.id}`);
    }

    async handleDisconnect(socket: Socket) {
      this.logger.log(`Client disconnected: ${socket.id}`);
    }

    @SubscribeMessage('joinRoom')
    handleJoinRoom(socket: Socket, data: { roomId: string; username: string }) {
      const { roomId, username } = data;
      socket.join(roomId);
      this.server.to(roomId).emit('userJoined', { username, roomId });
      this.logger.log(`User ${username} joined room ${roomId}`);
    }

    @SubscribeMessage('message')
    async handleMessage(socket: Socket, data: { roomId: string; content: string; user: { username: string } }) {
      const { roomId, content, user } = data;

      try {
        // Rate limit the messages
        await this.rateLimiter.consume(socket.id);
      } catch (rateLimiterRes) {
        socket.emit('error', 'Rate limit exceeded. Please slow down.');
        return;
      }

      this.logger.log(`Message from ${user.username} in room ${roomId}: ${content}`);

      // Save message to the database
      const sanitizedContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const message = await this.chatService.addMessage(roomId, sanitizedContent, user.username);

      // Emit message to room
      this.server.to(roomId).emit('message', { ...message, user });
    }
  }
