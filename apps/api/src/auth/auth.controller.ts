import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
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
    @Res({ passthrough: true }) res: any,
  ) {
    const user = await this.authService.register(dto);
    const token = this.authService.generateToken(user);
    this.setCookie(res, token);
    return user;
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    const token = this.authService.generateToken(user);
    this.setCookie(res, token);
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    const user = req.user as { id: string; email: string };
    return this.authService.getProfile(user.id);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: any) {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    return { message: 'Logged out' };
  }

  private setCookie(res: any, token: string) {
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
