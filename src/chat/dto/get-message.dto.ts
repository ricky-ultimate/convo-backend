import { IsNotEmpty, IsString } from 'class-validator';

export class GetMessagesDto {
  @IsString()
  @IsNotEmpty({ message: 'Chat room name is required' })
  chatRoomName: string;
}
