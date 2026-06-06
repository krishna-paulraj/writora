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
import { Throttle } from '@nestjs/throttler';
import * as express from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  // Signup abuse — 5 new accounts per hour per IP is plenty for legitimate use.
  @Throttle({ default: { limit: 5, ttl: HOUR } })
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

  // Brute-force protection — 10 attempts per minute per IP.
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
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
  async updateMe(@Req() req: express.Request, @Body() data: UpdateProfileDto) {
    const user = req.user as { id: string };
    return this.authService.updateProfile(user.id, data);
  }

  // Email-bomb protection — 3 reset emails per hour per IP.
  @Throttle({ default: { limit: 3, ttl: HOUR } })
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    await this.authService.requestPasswordReset(body.email);
    // Always return success — don't disclose whether the email exists
    return { ok: true };
  }

  // Token-guessing protection — 10 attempts per hour per IP.
  @Throttle({ default: { limit: 10, ttl: HOUR } })
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    await this.authService.resetPassword(body.token, body.password);
    return { ok: true };
  }

  // Verification links are clicked at most a few times — generous cap.
  @Throttle({ default: { limit: 20, ttl: HOUR } })
  @Post('verify-email')
  async verifyEmail(@Body() body: { token: string }) {
    return this.authService.verifyEmail(body.token);
  }

  // Resend abuse — 3 per hour per user (the IP throttle is per-IP).
  @Throttle({ default: { limit: 3, ttl: HOUR } })
  @UseGuards(JwtAuthGuard)
  @Post('resend-verification')
  async resendVerification(@Req() req: express.Request) {
    const user = req.user as { id: string };
    await this.authService.resendVerification(user.id);
    return { ok: true };
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
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3001';
    res.redirect(appUrl);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: express.Response) {
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN');
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      ...(cookieDomain && { domain: cookieDomain }),
    });
    return { message: 'Logged out' };
  }

  private setCookie(res: express.Response, token: string) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN');
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...(cookieDomain && { domain: cookieDomain }),
    });
  }
}
