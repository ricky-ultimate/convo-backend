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
  import { JwtService } from '@nestjs/jwt';

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

    constructor(
      private readonly chatService: ChatService,
      private readonly jwtService: JwtService,
    ) {}

    afterInit(server: Server) {
      this.logger.log('WebSocket server initialized');
    }

    // Handle WebSocket connection and validate JWT token
    async handleConnection(socket: Socket) {
      const token = socket.handshake.headers.authorization?.split(' ')[1]; // Extract Bearer token
      if (!token) {
        this.logger.error(`No token provided. Disconnecting socket: ${socket.id}`);
        socket.disconnect();
        return;
      }

      try {
        // Validate JWT token
        const decoded = this.jwtService.verify(token);
        socket.data.user = decoded; // Attach decoded user info to socket
        this.logger.log(`Client connected: ${socket.id} with user ${decoded.username}`);
      } catch (err) {
        this.logger.error(`Invalid token for socket: ${socket.id}`);
        socket.disconnect(); // Disconnect the client if the token is invalid
      }
    }

    // Handle WebSocket disconnection
    async handleDisconnect(socket: Socket) {
      this.logger.log(`Client disconnected: ${socket.id}`);
    }

    // Handle users joining a room
    @SubscribeMessage('joinRoom')
    async handleJoinRoom(socket: Socket, data: { roomId: string }) {
      const { roomId } = data;
      const username = socket.data.user.username;

      // Ensure roomId and username are provided
      if (!roomId || !username) {
        this.logger.error(`Room ID or Username is missing for socket: ${socket.id}`);
        socket.emit('error', 'Room ID or Username is missing.');
        return;
      }

      // Check if the user is a member of the room before allowing them to join
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

    // Handle message sending and validation
    @SubscribeMessage('message')
    async handleMessage(
      socket: Socket,
      data: { roomId: string; content: string },
    ) {
      const { roomId, content } = data;
      const username = socket.data.user.username;

      // Ensure roomId and username are provided
      if (!roomId || !username) {
        this.logger.error(`Room ID or Username is missing for socket: ${socket.id}`);
        socket.emit('error', 'Room ID or Username is missing.');
        return;
      }

      try {
        // Validate if the user is a member of the room
        const isMember = await this.chatService.isUserInRoom(roomId, username);
        if (!isMember) {
          this.logger.error(`User ${username} is not a member of room ${roomId}`);
          socket.emit('error', 'You are not a member of this room.');
          return;
        }

        // Rate limit the messages to avoid spamming
        await this.rateLimiter.consume(socket.id);
      } catch (rateLimiterRes) {
        socket.emit('error', 'Rate limit exceeded. Please slow down.');
        return;
      }

      this.logger.log(`Message from ${username} in room ${roomId}: ${content}`);

      // Sanitize and save message to the database
      const sanitizedContent = content
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const message = await this.chatService.addMessage(roomId, sanitizedContent, username);

      if (!message) {
        this.logger.error(`Failed to save message from ${username} in room ${roomId}`);
        socket.emit('error', 'Failed to save message.');
        return;
      }

      // Emit the message to the room
      this.server.to(roomId).emit('message', { ...message, user: { username } });
    }
  }
