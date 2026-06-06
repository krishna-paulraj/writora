import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}
