import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CacheService } from '../cache/cache.service';

type Mocked<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? jest.Mock<R, A>
    : T[K];
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: Mocked<{ findUnique: any; create: any; update: any }> };
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
    it('signs sub+email into the JWT payload', () => {
      const token = service.generateToken({
        id: 'u1',
        email: 'alice@example.com',
      });
      expect(token).toBe('signed.jwt.token');
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'alice@example.com',
      });
    });
  });

  describe('updateProfile', () => {
    it('normalizes customDomain to lowercase and trims it', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        username: 'alice',
        customDomain: null,
      });
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        name: 'Alice',
        email: 'a@e.com',
        username: 'alice',
        blogTheme: 'default',
        customDomain: 'foo.com',
        bio: null,
        avatarUrl: null,
        twitterHandle: null,
        websiteUrl: null,
        emailVerified: null,
      });

      await service.updateProfile('u1', { customDomain: '  FOO.com ' });

      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.customDomain).toBe('foo.com');
    });

    it('clears customDomain when given an empty string', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        username: 'alice',
        customDomain: 'old.com',
      });
      prisma.user.update.mockResolvedValue({
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
      });

      await service.updateProfile('u1', { customDomain: '' });

      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.customDomain).toBeNull();
    });

    it('invalidates the domain cache for both old and new domain', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        username: 'alice',
        customDomain: 'old.com',
      });
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        name: 'Alice',
        email: 'a@e.com',
        username: 'alice',
        blogTheme: 'default',
        customDomain: 'new.com',
        bio: null,
        avatarUrl: null,
        twitterHandle: null,
        websiteUrl: null,
        emailVerified: null,
      });

      await service.updateProfile('u1', { customDomain: 'new.com' });

      const delCalls = cache.del.mock.calls.flat();
      expect(delCalls).toEqual(
        expect.arrayContaining(['blog:domain:old.com', 'blog:domain:new.com']),
      );
    });

    it('does not touch domain cache when customDomain is unchanged', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        username: 'alice',
        customDomain: null,
      });
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        name: 'Alice Smith',
        email: 'a@e.com',
        username: 'alice',
        blogTheme: 'default',
        customDomain: null,
        bio: null,
        avatarUrl: null,
        twitterHandle: null,
        websiteUrl: null,
        emailVerified: null,
      });

      cache.del.mockClear();
      await service.updateProfile('u1', { name: 'Alice Smith' });

      // del may still be called for the profile cache key, but not for any
      // blog:domain:* key
      const allDelArgs = cache.del.mock.calls.flat();
      const domainKeys = allDelArgs.filter((k: string) =>
        k.startsWith('blog:domain:'),
      );
      expect(domainKeys).toHaveLength(0);
    });
  });
});
