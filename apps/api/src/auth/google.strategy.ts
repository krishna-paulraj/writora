import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

// Google sign-in is optional. passport-google-oauth20 throws in its constructor
// when clientID is missing, so the strategy must only ever be constructed when
// all three vars are present — AuthModule registers it via a factory gated on
// this check, and GoogleAuthGuard 503s the /auth/google routes when it's off.
export function isGoogleAuthConfigured(config: ConfigService): boolean {
  return Boolean(
    config.get<string>('GOOGLE_AUTH_CLIENT_ID') &&
    config.get<string>('GOOGLE_AUTH_SECRET_ID') &&
    config.get<string>('GOOGLE_REDIRECT_URL'),
  );
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_AUTH_CLIENT_ID')!,
      clientSecret: configService.get<string>('GOOGLE_AUTH_SECRET_ID')!,
      callbackURL: configService.get<string>('GOOGLE_REDIRECT_URL')!,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value ?? '';
    // Google asserts whether the user actually owns this email. We refuse to
    // proceed (and especially to LINK this Google identity onto an existing
    // password account) unless the email is verified — otherwise someone with
    // an unverified Google account on a victim's email could take it over.
    const json = profile._json as { email_verified?: boolean } | undefined;
    if (!email || json?.email_verified !== true) {
      done(
        new UnauthorizedException('Your Google account email is not verified'),
        false,
      );
      return;
    }
    const user = { googleId: profile.id, email, name: profile.displayName };
    done(null, user);
  }
}
