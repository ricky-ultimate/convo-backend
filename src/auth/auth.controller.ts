import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedRequest } from './types';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ApiLogin,
  ApiLogout,
  ApiRegister,
} from '../common/decorators/auth.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiRegister()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const { email, username, password } = registerDto;
    return this.authService.register(email, username, password);
  }

  @ApiLogin()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      return { error: 'Invalid credentials' };
    }
    return this.authService.login(user);
  }

  @ApiLogout()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() request: AuthenticatedRequest) {
    const userId = request.user.id;
    await this.authService.logout(userId);
    return { message: 'Logged out successfully' };
  }
}
