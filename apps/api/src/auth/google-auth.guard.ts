import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { isGoogleAuthConfigured } from './google.strategy';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // The 'google' strategy is only registered when the env vars are set;
    // without this check passport would 500 with "Unknown authentication
    // strategy" instead of an actionable error.
    if (!isGoogleAuthConfigured(this.configService)) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured on this server',
      );
    }
    return super.canActivate(context);
  }
}
