import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export const ApiStandardResponses = () =>
  applyDecorators(
    ApiResponse({
      status: 400,
      description: 'Bad Request',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 400 },
          timestamp: { type: 'string', example: '2023-01-01T00:00:00.000Z' },
          path: { type: 'string', example: '/v1/auth/login' },
          method: { type: 'string', example: 'POST' },
          correlationId: { type: 'string', example: 'uuid-here' },
          error: { type: 'string', example: 'Bad Request' },
          message: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 401 },
          timestamp: { type: 'string' },
          path: { type: 'string' },
          method: { type: 'string' },
          correlationId: { type: 'string' },
          error: { type: 'string', example: 'Unauthorized' },
          message: { type: 'string', example: 'Invalid credentials' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal Server Error',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          timestamp: { type: 'string' },
          path: { type: 'string' },
          method: { type: 'string' },
          correlationId: { type: 'string' },
          error: { type: 'string', example: 'Internal Server Error' },
          message: { type: 'string', example: 'Internal server error' },
        },
      },
    }),
  );

export const ApiAuthRequired = () =>
  applyDecorators(
    ApiResponse({
      status: 401,
      description: 'Authentication required',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 401 },
          message: { type: 'string', example: 'Session expired or invalid.' },
        },
      },
    }),
  );
