import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
      }>(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      return this.authService.refresh(payload.sub, dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}

