import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SetDomainDto {
  // null (or omitted) clears the domain. 253 chars is the DNS hostname limit;
  // the service does the real format validation + entitlement check.
  @IsOptional()
  @IsString()
  @MaxLength(253)
  customDomain?: string | null;
}
