import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateNetworkDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['dofollow', 'nofollow'])
  relPolicy?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxOutboundPerPost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  niche?: string | null;
}
