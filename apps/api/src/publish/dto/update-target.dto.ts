import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateTargetDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;

  // Optional credential rotation — re-validated and re-encrypted when present.
  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;
}
