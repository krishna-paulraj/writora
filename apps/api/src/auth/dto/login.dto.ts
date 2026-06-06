import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(200)
  password: string;
}
