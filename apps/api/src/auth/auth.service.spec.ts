import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CacheService } from '../cache/cache.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

type Mocked<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? jest.Mock<R, A>
    : T[K];
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: Mocked<{ sign: any }>;
  let cache: Mocked<{
    get: any;
    set: any;
    del: any;
    delPattern: any;
    wrap: any;
  }>;
  let email: Mocked<{
    sendVerifyEmail: any;
    sendPasswordReset: any;
  }>;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      site: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
    };
    jwt = { sign: jest.fn(() => 'signed.jwt.token') };
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
      wrap: jest.fn(),
    };
    email = {
      sendVerifyEmail: jest.fn(),
      sendPasswordReset: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: EmailService, useValue: email },
        { provide: CacheService, useValue: cache },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => undefined) },
        },
        {
          provide: EntitlementsService,
          useValue: { summary: jest.fn().mockResolvedValue({ plan: 'free' }) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('hashes the password and creates the user', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // no email collision, no username collision
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        username: 'alice',
        password: 'hashed',
      });

      const result = await service.register({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'plaintext123',
      });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.email).toBe('alice@example.com');
      expect(createCall.data.password).not.toBe('plaintext123'); // hashed
      expect(
        await bcrypt.compare('plaintext123', createCall.data.password),
      ).toBe(true);

      // Response must NOT leak the password hash
      expect(result).toEqual({
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        username: 'alice',
      });
      expect(result).not.toHaveProperty('password');
    });

    it('rejects duplicate emails with ConflictException', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' });

      await expect(
        service.register({
          name: 'Alice',
          email: 'alice@example.com',
          password: 'plaintext123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('returns the user on correct credentials', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        username: 'alice',
        password: hashed,
      });

      const result = await service.validateUser(
        'alice@example.com',
        'correct-password',
      );

      expect(result).toEqual({
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        username: 'alice',
      });
    });

    it('throws UnauthorizedException on unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.validateUser('nobody@example.com', 'whatever'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        username: 'alice',
        password: hashed,
      });
      await expect(
        service.validateUser('alice@example.com', 'wrong-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects Google-only users from password login', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        username: 'alice',
        password: null,
      });
      await expect(
        service.validateUser('alice@example.com', 'anything'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('generateToken', () => {
    it('signs sub+email+token-version into the JWT payload', () => {
      const token = service.generateToken({
        id: 'u1',
        email: 'alice@example.com',
      });
      expect(token).toBe('signed.jwt.token');
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'alice@example.com',
        tv: 0,
      });
    });

    it('signs the user tokenVersion so password resets invalidate old tokens', () => {
      service.generateToken({
        id: 'u1',
        email: 'alice@example.com',
        tokenVersion: 3,
      });
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'alice@example.com',
        tv: 3,
      });
    });
  });

  describe('updateProfile', () => {
    const updatedUser = {
      id: 'u1',
      name: 'Alice',
      email: 'a@e.com',
      username: 'alice',
      blogTheme: 'default',
      customDomain: null,
      bio: null,
      avatarUrl: null,
      twitterHandle: null,
      websiteUrl: null,
      emailVerified: null,
    };

    it('updates the name and mirrors profile fields to the primary site', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ username: 'alice' });
      prisma.user.update.mockResolvedValue(updatedUser);

      await service.updateProfile('u1', { name: 'Alice Smith', bio: 'hi' });

      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.name).toBe('Alice Smith');
      // Profile fields mirror to the primary site (public pages read from it).
      expect(prisma.site.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', isPrimary: true },
        data: { bio: 'hi' },
      });
    });

    it('never writes the deprecated customDomain via /auth/me', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ username: 'alice' });
      prisma.user.update.mockResolvedValue(updatedUser);

      // A legacy client may still send customDomain — it must be ignored here
      // (domains are gated + per-site via PATCH /sites/:id/domain).
      await service.updateProfile('u1', {
        name: 'Alice',
        customDomain: 'evil.com',
      } as unknown as { name: string });

      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.customDomain).toBeUndefined();
    });

    it('rejects a reserved username', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ username: 'alice' });
      await expect(
        service.updateProfile('u1', { username: 's' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
