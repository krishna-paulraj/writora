export class UpdateTargetDto {
  name?: string;
  enabled?: boolean;
  autoPublish?: boolean;
  // Optional credential rotation — re-validated and re-encrypted when present.
  credentials?: Record<string, unknown>;
}
