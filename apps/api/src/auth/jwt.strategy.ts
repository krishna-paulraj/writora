import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const token: unknown = req?.cookies?.['token'];
          return typeof token === 'string' ? token : null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: { sub: string; email: string; tv?: number }) {
    // Re-check the token version against the DB so a password reset (which bumps
    // tokenVersion) immediately invalidates every previously-issued JWT. This is
    // a single indexed PK lookup per authenticated request.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, tokenVersion: true },
    });
    if (!user) throw new UnauthorizedException();
    if ((payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }
    return { id: user.id, email: user.email };
  }
}
