import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    example: 'Hello everyone! How are you doing today?',
    description: 'Message content',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Message content is required' })
  @MaxLength(1000, { message: 'Message must be less than 1000 characters' })
  content: string;
}
