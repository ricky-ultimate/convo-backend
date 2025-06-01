import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    example: 'General Chat',
    description: 'Chat room name',
    minLength: 1,
    maxLength: 50,
    pattern: '^[a-zA-Z0-9\\s_-]+$',
  })
  @IsString()
  @IsNotEmpty({ message: 'Room name is required' })
  @MinLength(1, { message: 'Room name cannot be empty' })
  @MaxLength(50, { message: 'Room name must be less than 50 characters' })
  @Matches(/^[a-zA-Z0-9\s_-]+$/, {
    message:
      'Room name can only contain letters, numbers, spaces, hyphens, and underscores',
  })
  name: string;
}
