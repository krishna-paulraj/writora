import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const user = await this.authService.register(dto);
    const token = this.authService.generateToken(user);
    this.setCookie(res, token);
    return user;
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    const token = this.authService.generateToken(user);
    this.setCookie(res, token);
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: express.Request) {
    const user = req.user as { id: string; email: string };
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @Req() req: express.Request,
    @Body() data: { name?: string; username?: string; blogTheme?: string; customDomain?: string },
  ) {
    const user = req.user as { id: string };
    return this.authService.updateProfile(user.id, data);
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleLogin() {
    // Guard redirects to Google
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    const googleUser = req.user as {
      googleId: string;
      email: string;
      name: string;
    };
    const user = await this.authService.findOrCreateGoogleUser(googleUser);
    const token = this.authService.generateToken(user);
    this.setCookie(res, token);

    const appUrl =
      this.configService.get('NODE_ENV') === 'production'
        ? 'https://app.writora.com'
        : 'http://localhost:3001';
    res.redirect(appUrl);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: express.Response) {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    return { message: 'Logged out' };
  }

  private setCookie(res: express.Response, token: string) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...(isProduction && { domain: '.writora.com' }),
    });
  }
}
