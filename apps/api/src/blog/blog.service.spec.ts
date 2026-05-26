import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BlogService } from './blog.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CacheService } from '../cache/cache.service';
import { QueueService } from '../queue/queue.service';

describe('BlogService', () => {
  let service: BlogService;
  let prisma: any;
  let cache: any;
  let queue: any;

  beforeEach(async () => {
    prisma = {
      blog: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      subscriber: { findMany: jest.fn() },
    };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
      wrap: jest.fn((_key: string, _ttl: number, fetcher: () => Promise<any>) =>
        fetcher(),
      ),
    };
    queue = {
      enqueue: jest.fn(),
      consume: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: {} },
        { provide: CacheService, useValue: cache },
        { provide: QueueService, useValue: queue },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => undefined) },
        },
      ],
    }).compile();

    service = module.get(BlogService);
  });

  describe('create', () => {
    it('sanitizes content before storing', async () => {
      prisma.blog.findUnique.mockResolvedValue(null);
      prisma.blog.create.mockResolvedValue({
        id: 'b1',
        slug: 's',
        authorId: 'u1',
      });
      prisma.user.findUnique.mockResolvedValue({ username: 'alice' });

      await service.create('u1', {
        slug: 's',
        title: 't',
        description: 'd',
        content: '<p>safe</p><script>alert("xss")</script>',
        category: 'c',
      } as any);

      const createCall = prisma.blog.create.mock.calls[0][0];
      expect(createCall.data.content).not.toContain('<script');
      expect(createCall.data.content).not.toContain('alert');
      expect(createCall.data.content).toContain('<p>safe</p>');
    });

    it('invalidates the author cache after create', async () => {
      prisma.blog.findUnique.mockResolvedValue(null);
      prisma.blog.create.mockResolvedValue({
        id: 'b1',
        slug: 's',
        authorId: 'u1',
      });
      prisma.user.findUnique.mockResolvedValue({ username: 'alice' });

      await service.create('u1', {
        slug: 's',
        title: 't',
        description: 'd',
        content: '<p>x</p>',
        category: 'c',
      } as any);

      expect(cache.delPattern).toHaveBeenCalledWith('blog:public:*:alice*');
    });
  });

  describe('update', () => {
    it('queues newsletter blast on the first transition to published', async () => {
      prisma.blog.findUnique.mockResolvedValue({
        id: 'b1',
        slug: 's',
        title: 't',
        authorId: 'u1',
        published: false,
        newsletterSent: false,
      });
      prisma.blog.update.mockResolvedValue({
        id: 'b1',
        slug: 's',
        title: 't',
        authorId: 'u1',
        published: true,
        newsletterSent: false,
      });
      prisma.user.findUnique.mockResolvedValue({ username: 'alice' });

      await service.update('b1', 'u1', { published: true } as any);

      const enqueuedQueues = queue.enqueue.mock.calls.map((c: any[]) => c[0]);
      expect(enqueuedQueues).toContain('newsletter.blast');
    });

    it('does not re-queue a newsletter for an already-sent post', async () => {
      prisma.blog.findUnique.mockResolvedValue({
        id: 'b1',
        slug: 's',
        title: 't',
        authorId: 'u1',
        published: true, // already published
        newsletterSent: true,
      });
      prisma.blog.update.mockResolvedValue({
        id: 'b1',
        slug: 's',
        title: 't',
        authorId: 'u1',
        published: true,
        newsletterSent: true,
      });
      prisma.user.findUnique.mockResolvedValue({ username: 'alice' });

      await service.update('b1', 'u1', { title: 'New title' } as any);

      const enqueuedQueues = queue.enqueue.mock.calls.map((c: any[]) => c[0]);
      expect(enqueuedQueues).not.toContain('newsletter.blast');
    });

    it('invalidates author cache on update', async () => {
      prisma.blog.findUnique.mockResolvedValue({
        id: 'b1',
        slug: 's',
        title: 't',
        authorId: 'u1',
        published: false,
        newsletterSent: false,
      });
      prisma.blog.update.mockResolvedValue({
        id: 'b1',
        slug: 's',
        title: 't',
        authorId: 'u1',
        published: false,
        newsletterSent: false,
      });
      prisma.user.findUnique.mockResolvedValue({ username: 'alice' });

      await service.update('b1', 'u1', { title: 'New' } as any);

      expect(cache.delPattern).toHaveBeenCalledWith('blog:public:*:alice*');
    });
  });

  describe('remove', () => {
    it('invalidates the author cache after delete', async () => {
      prisma.blog.findUnique.mockResolvedValue({
        id: 'b1',
        authorId: 'u1',
      });
      prisma.blog.delete.mockResolvedValue({ id: 'b1' });
      prisma.user.findUnique.mockResolvedValue({ username: 'alice' });

      await service.remove('b1', 'u1');

      expect(cache.delPattern).toHaveBeenCalledWith('blog:public:*:alice*');
    });
  });

  describe('findUsernameByDomain', () => {
    it('caches a hit and returns the username', async () => {
      cache.get.mockResolvedValue(null);
      prisma.user.findUnique = jest.fn();
      prisma.user.findFirst = jest
        .fn()
        .mockResolvedValue({ username: 'alice' });

      const result = await service.findUsernameByDomain('Example.com');

      expect(result).toEqual({ username: 'alice' });
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { customDomain: 'example.com' },
        select: { username: true },
      });
      expect(cache.set).toHaveBeenCalledWith(
        'blog:domain:example.com',
        { username: 'alice' },
        expect.any(Number),
      );
    });

    it('caches a miss with null so unknown hosts do not hammer the DB', async () => {
      cache.get.mockResolvedValue(null);
      prisma.user.findFirst = jest.fn().mockResolvedValue(null);

      const result = await service.findUsernameByDomain('unknown.example');

      expect(result).toBeNull();
      expect(cache.set).toHaveBeenCalledWith(
        'blog:domain:unknown.example',
        { username: null },
        expect.any(Number),
      );
    });

    it('serves from cache when present (no DB call)', async () => {
      cache.get.mockResolvedValue({ username: 'alice' });
      prisma.user.findFirst = jest.fn();

      const result = await service.findUsernameByDomain('example.com');

      expect(result).toEqual({ username: 'alice' });
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });
});
