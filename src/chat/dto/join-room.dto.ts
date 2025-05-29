import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty({ message: 'Room ID is required' })
  @IsUUID('4', { message: 'Room ID must be a valid UUID' })
  roomId: string;
}
