import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Chat room name is required' })
  chatRoomName: string;

  @IsString()
  @IsNotEmpty({ message: 'Message content is required' })
  @MaxLength(1000, { message: 'Message must be less than 1000 characters' })
  content: string;
}
