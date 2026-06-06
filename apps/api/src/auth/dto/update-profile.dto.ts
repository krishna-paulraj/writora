import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Allow-listed profile fields editable via PATCH /auth/me. Critically, this is
 * the ONLY set of User columns a client may write here — sensitive columns
 * (plan, subscriptionStatus, aiUsageCount, emailVerified, …) are intentionally
 * absent so the global ValidationPipe's `whitelist` strips them, preventing
 * mass-assignment / self-service plan escalation.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  blogTheme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customDomain?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  twitterHandle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  websiteUrl?: string;
}
