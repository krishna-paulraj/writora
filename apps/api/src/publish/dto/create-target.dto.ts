import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTargetDto {
  @IsIn(['wordpress', 'devto', 'x'])
  platform: string; // wordpress | devto | x

  @IsString()
  @MaxLength(100)
  name: string;

  // Platform-specific secrets, e.g. { siteUrl, token }, { apiKey }, or
  // { apiKey, apiSecret, accessToken, accessTokenSecret } for X. Encrypted at
  // rest; validated by the platform adapter.
  @IsObject()
  credentials: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;
}
