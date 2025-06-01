import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import {
  ApiStandardResponses,
  ApiAuthRequired,
} from './base-responses.decorator';

export const ApiCreateRoom = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a new chat room',
      description: 'Create a new chat room with a unique name',
    }),
    ApiResponse({
      status: 201,
      description: 'Room created successfully',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'uuid-here' },
          name: { type: 'string', example: 'General Chat' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    }),
    ApiStandardResponses(),
    ApiAuthRequired(),
  );

export const ApiSendMessage = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Send a message to a chat room',
      description: 'Send a message to a specific chat room',
    }),
    ApiParam({
      name: 'roomId',
      type: 'string',
      format: 'uuid',
      description: 'Chat room ID',
      example: 'uuid-here',
    }),
    ApiResponse({
      status: 201,
      description: 'Message sent successfully',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          content: { type: 'string', example: 'Hello everyone!' },
          createdAt: { type: 'string', format: 'date-time' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              username: { type: 'string', example: 'john_doe' },
            },
          },
        },
      },
    }),
    ApiStandardResponses(),
    ApiAuthRequired(),
  );

export const ApiGetMessages = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get messages from a chat room',
      description: 'Retrieve paginated messages from a specific chat room',
    }),
    ApiParam({
      name: 'roomId',
      type: 'string',
      format: 'uuid',
      description: 'Chat room ID',
    }),
    ApiQuery({
      name: 'page',
      type: 'number',
      required: false,
      description: 'Page number (default: 1)',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      type: 'number',
      required: false,
      description: 'Messages per page (default: 50, max: 100)',
      example: 50,
    }),
    ApiResponse({
      status: 200,
      description: 'Messages retrieved successfully',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            content: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            user: {
              type: 'object',
              properties: { username: { type: 'string' } },
            },
          },
        },
      },
    }),
    ApiStandardResponses(),
    ApiAuthRequired(),
  );

export const ApiJoinRoom = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Join a chat room',
      description: 'Join an existing chat room',
    }),
    ApiResponse({
      status: 200,
      description: 'Successfully joined room',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Successfully joined room' },
          room: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    }),
    ApiStandardResponses(),
    ApiAuthRequired(),
  );

export const ApiLeaveRoom = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Leave a chat room',
      description: 'Leave a chat room you are currently a member of',
    }),
    ApiParam({
      name: 'roomId',
      type: 'string',
      format: 'uuid',
      description: 'Chat room ID',
    }),
    ApiResponse({
      status: 200,
      description: 'Successfully left room',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Successfully left room' },
        },
      },
    }),
    ApiStandardResponses(),
    ApiAuthRequired(),
  );

export const ApiGetRoomMembers = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get room members',
      description: 'Get list of all members in a chat room',
    }),
    ApiParam({
      name: 'roomId',
      type: 'string',
      format: 'uuid',
      description: 'Chat room ID',
    }),
    ApiResponse({
      status: 200,
      description: 'Room members retrieved successfully',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            username: { type: 'string', example: 'john_doe' },
            joinedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    }),
    ApiStandardResponses(),
    ApiAuthRequired(),
  );

export const ApiGetUserRooms = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get user rooms',
      description: 'Get all chat rooms the current user is a member of',
    }),
    ApiResponse({
      status: 200,
      description: 'User rooms retrieved successfully',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            joinedAt: { type: 'string', format: 'date-time' },
            messageCount: { type: 'number' },
            memberCount: { type: 'number' },
          },
        },
      },
    }),
    ApiStandardResponses(),
    ApiAuthRequired(),
  );

export const ApiGetRoomInfo = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get room information',
      description: 'Get detailed information about a specific chat room',
    }),
    ApiParam({
      name: 'roomId',
      type: 'string',
      format: 'uuid',
      description: 'Chat room ID',
    }),
    ApiResponse({
      status: 200,
      description: 'Room information retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          messageCount: { type: 'number' },
          memberCount: { type: 'number' },
        },
      },
    }),
    ApiStandardResponses(),
    ApiAuthRequired(),
  );

export const ApiDeleteMessage = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Delete a message from a chat room',
      description:
        'Delete a specific message from a chat room. Users can only delete their own messages.',
    }),
    ApiParam({
      name: 'roomId',
      type: 'string',
      format: 'uuid',
      description: 'Chat room ID',
      example: 'uuid-here',
    }),
    ApiParam({
      name: 'messageId',
      type: 'string',
      format: 'uuid',
      description: 'Message ID to delete',
      example: 'uuid-here',
    }),
    ApiResponse({
      status: 200,
      description: 'Message deleted successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Message deleted successfully' },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description:
        'Unauthorized - User not authenticated or not authorized to delete this message',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 401 },
          message: {
            type: 'string',
            example:
              'You are not authorized to delete this message. You can only delete your own messages.',
          },
          error: { type: 'string', example: 'Unauthorized' },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Message or room not found',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 404 },
          message: { type: 'string', example: 'Message not found' },
          error: { type: 'string', example: 'Not Found' },
        },
      },
    }),
    ApiStandardResponses(),
    ApiAuthRequired(),
  );
