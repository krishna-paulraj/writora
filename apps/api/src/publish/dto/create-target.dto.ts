export class CreateTargetDto {
  platform: string; // wordpress | devto | x
  name: string;
  // Platform-specific secrets, e.g. { siteUrl, token }, { apiKey }, or
  // { apiKey, apiSecret, accessToken, accessTokenSecret } for X. Encrypted at
  // rest; validated by the platform adapter.
  credentials: Record<string, unknown>;
  autoPublish?: boolean;
}
