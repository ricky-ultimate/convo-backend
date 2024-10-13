# Convo Backend

This is the backend service for the chat application built using **NestJS**, **Prisma**, **Redis**, and **WebSocket** technologies. The backend provides authentication, real-time messaging, session management, and rate-limiting using Redis.

## Features

- **User Registration & Authentication**: JWT-based authentication with secure session storage.
- **Real-time Chat**: WebSocket-based messaging system with support for multiple chat rooms.
- **Redis Caching**: Frequently accessed data (e.g., chat messages) are cached in Redis to improve performance.
- **Rate Limiting**: Redis-based rate limiting to control how many messages a user can send in a specified period.
- **Database**: Prisma ORM connected to a PostgreSQL database for managing users, messages, and chat rooms.
- **Session Management**: Redis is used to store user login sessions for faster authentication checks.

## Technologies

- [NestJS](https://nestjs.com/) - Node.js framework for building efficient and scalable server-side applications.
- [Prisma](https://www.prisma.io/) - ORM for managing PostgreSQL database.
- [Redis](https://redis.io/) - In-memory data store used for caching and rate-limiting.
- [Socket.io](https://socket.io/) - Real-time bidirectional event-based communication for chat functionality.
- [JWT](https://jwt.io/) - JSON Web Token for secure user authentication.

## Requirements

- Node.js (v16 or higher)
- PostgreSQL Database
- Redis server
- Docker (optional)

## Getting Started

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/ricky-ultimate/convo-backend.git
    cd convo-backend
    ```

2. Install the dependencies:

    ```bash
    npm install
    ```

### Environment Variables

Create a `.env` file in the root directory and configure the following environment variables:

```bash
# PostgreSQL database
DATABASE_URL=postgresql://user:password@localhost:5432/chatapp

# JWT configuration
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your-session-secret

# Redis configuration
REDIS_URL=redis://localhost:6379

# Rate-limiting configuration
RATE_LIMIT_POINTS=5      # Max messages per duration
RATE_LIMIT_DURATION=10   # Duration in seconds for rate-limiting
```


### Running the Application
To run the server in development mode:
```bash
npm run start
```


### API Endpoints
- User Registration: Post `/auth/register`
- User Login: Post `/auth/login`
- Create Chat Room: Post `/chat/room`
- Send Message: Post `/chat/message`
- Get Messages: GET `/chat/messages?chatRoomName=room-name`
