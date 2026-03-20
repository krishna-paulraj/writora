import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const username = await this.generateUsername(dto.name);
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        username,
        password: hashedPassword,
      },
    });

    return this.buildResponse(user);
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Please sign in with Google');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildResponse(user);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      blogTheme: user.blogTheme,
      customDomain: user.customDomain,
    };
  }

  async updateProfile(
    userId: string,
    data: { name?: string; username?: string; blogTheme?: string; customDomain?: string },
  ) {
    if (data.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: data.username },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Username already taken');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      blogTheme: user.blogTheme,
      customDomain: user.customDomain,
    };
  }

  async findOrCreateGoogleUser(googleProfile: {
    googleId: string;
    email: string;
    name: string;
  }) {
    // Check if user already exists with this googleId
    const existingByGoogleId = await this.prisma.user.findUnique({
      where: { googleId: googleProfile.googleId },
    });
    if (existingByGoogleId) {
      return this.buildResponse(existingByGoogleId);
    }

    // Check if user exists with same email (link accounts)
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: googleProfile.email },
    });
    if (existingByEmail) {
      const updated = await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: { googleId: googleProfile.googleId },
      });
      return this.buildResponse(updated);
    }

    // Create new user
    const username = await this.generateUsername(googleProfile.name);
    const user = await this.prisma.user.create({
      data: {
        name: googleProfile.name,
        email: googleProfile.email,
        username,
        googleId: googleProfile.googleId,
      },
    });
    return this.buildResponse(user);
  }

  generateToken(user: { id: string; email: string }) {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }

  private async generateUsername(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);
    let username = base || 'user';
    let suffix = 0;

    while (true) {
      const candidate = suffix === 0 ? username : `${username}${suffix}`;
      const existing = await this.prisma.user.findUnique({
        where: { username: candidate },
      });
      if (!existing) return candidate;
      suffix++;
    }
  }

  private buildResponse(user: {
    id: string;
    name: string;
    email: string;
    username: string;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
    };
  }
}
