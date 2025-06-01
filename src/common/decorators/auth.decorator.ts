import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from './base-responses.decorator';

export const ApiRegister = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Register a new user',
      description:
        'Create a new user account with email, username, and password',
    }),
    ApiResponse({
      status: 201,
      description: 'User registered successfully',
      schema: {
        type: 'object',
        properties: {
          access_token: {
            type: 'string',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            description: 'JWT access token',
          },
        },
      },
    }),
    ApiStandardResponses(),
  );

export const ApiLogin = () =>
  applyDecorators(
    ApiOperation({
      summary: 'User login',
      description: 'Authenticate user with email and password',
    }),
    ApiResponse({
      status: 200,
      description: 'Login successful',
      schema: {
        type: 'object',
        properties: {
          access_token: {
            type: 'string',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            description: 'JWT access token',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Invalid credentials',
      schema: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            example: 'Invalid credentials',
          },
        },
      },
    }),
    ApiStandardResponses(),
  );

export const ApiLogout = () =>
  applyDecorators(
    ApiOperation({
      summary: 'User logout',
      description: 'Logout user and invalidate session',
    }),
    ApiResponse({
      status: 200,
      description: 'Logout successful',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Logged out successfully',
          },
        },
      },
    }),
    ApiStandardResponses(),
  );
