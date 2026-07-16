import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(16)
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(8)
  // bcrypt only hashes the first 72 bytes — reject longer instead of silently
  // truncating.
  @MaxLength(72)
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(16)
  @MaxLength(200)
  token!: string;
}
