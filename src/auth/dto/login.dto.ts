import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    example: 'MySecurePass123',
    description: 'User password',
    format: 'password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
