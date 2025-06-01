import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class JoinRoomDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Chat room UUID',
    format: 'uuid',
  })
  @IsString()
  @IsNotEmpty({ message: 'Room ID is required' })
  @IsUUID('4', { message: 'Room ID must be a valid UUID' })
  roomId: string;
}
