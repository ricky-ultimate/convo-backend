import { IsNotEmpty, IsString } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty({ message: 'Room name is required' })
  roomName: string;
}
