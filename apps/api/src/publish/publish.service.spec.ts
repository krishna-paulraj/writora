import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PublishService } from './publish.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { WordPressAdapter } from './adapters/wordpress.adapter';
import { DevtoAdapter } from './adapters/devto.adapter';
import { XAdapter } from './adapters/x.adapter';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

describe('PublishService', () => {
  let service: PublishService;
  let prisma: any;
  let crypto: any;
  let wp: any;
  let devto: any;
  let x: any;
  let notifications: any;
  let entitlements: any;

  const blog = {
    id: 'b1',
    authorId: 'u1',
    title: 'Hello',
    slug: 'hello',
    description: 'desc',
    content: '<p>hi</p>',
    imageUrl: null,
    category: 'General',
    published: true,
    author: { username: 'alice' },
  };

  beforeEach(async () => {
    prisma = {
      publishTarget: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      publishRecord: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn((args: any) => ({ id: 'r1', ...args.create })),
      },
      blog: { findUnique: jest.fn() },
    };
    crypto = {
      isConfigured: jest.fn().mockReturnValue(true),
      encryptJson: jest.fn((o: unknown) => JSON.stringify(o)),
      decryptJson: jest.fn((s: string) => JSON.parse(s)),
    };
    wp = {
      platform: 'wordpress',
      validate: jest.fn(),
      test: jest.fn(),
      publish: jest.fn(),
    };
    devto = {
      platform: 'devto',
      validate: jest.fn(),
      test: jest.fn(),
      publish: jest.fn(),
    };
    x = {
      platform: 'x',
      validate: jest.fn(),
      test: jest.fn(),
      publish: jest.fn(),
    };
    notifications = { emit: jest.fn() };
    entitlements = { assertCanAddDestination: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishService,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptoService, useValue: crypto },
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
        { provide: NotificationsService, useValue: notifications },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: WordPressAdapter, useValue: wp },
        { provide: DevtoAdapter, useValue: devto },
        { provide: XAdapter, useValue: x },
      ],
    }).compile();

    service = module.get(PublishService);
  });

  describe('listTargets', () => {
    it('never selects the encrypted credentials column', async () => {
      prisma.publishTarget.findMany.mockResolvedValue([]);
      await service.listTargets('u1', 'site1');
      const arg = prisma.publishTarget.findMany.mock.calls[0][0];
      expect(arg.select.credentials).toBeUndefined();
      expect(arg.select.name).toBe(true);
    });
  });

  describe('addTarget', () => {
    it('503s when encryption is unconfigured', async () => {
      crypto.isConfigured.mockReturnValue(false);
      await expect(
        service.addTarget('u1', 'site1', {
          platform: 'wordpress',
          name: 'My WP',
          credentials: { siteUrl: 'https://x.com', token: 'abcd1234' },
        }),
      ).rejects.toThrow();
      expect(prisma.publishTarget.create).not.toHaveBeenCalled();
    });

    it('validates + encrypts and never returns credentials', async () => {
      prisma.publishTarget.create.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        platform: 'wordpress',
        name: 'My WP',
        credentials: 'ENCRYPTED',
        enabled: true,
        autoPublish: false,
      });
      const creds = { siteUrl: 'https://x.com', token: 'abcd1234' };
      const result = await service.addTarget('u1', 'site1', {
        platform: 'wordpress',
        name: 'My WP',
        credentials: creds,
      });
      expect(wp.validate).toHaveBeenCalledWith(creds);
      expect(crypto.encryptJson).toHaveBeenCalledWith(creds);
      expect((result as Record<string, unknown>).credentials).toBeUndefined();
      expect(result.name).toBe('My WP');
    });

    it('rejects an unknown platform', async () => {
      await expect(
        service.addTarget('u1', 'site1', {
          platform: 'tumblr',
          name: 'x',
          credentials: {},
        }),
      ).rejects.toThrow(/Unsupported platform/);
    });
  });

  describe('publishBlog', () => {
    it('refuses to cross-post an unpublished blog', async () => {
      prisma.blog.findUnique.mockResolvedValue({ ...blog, published: false });
      await expect(service.publishBlog('u1', 'b1')).rejects.toThrow(
        /Publish the post/,
      );
    });

    it("forbids publishing another user's blog", async () => {
      prisma.blog.findUnique.mockResolvedValue({ ...blog, authorId: 'u2' });
      await expect(service.publishBlog('u1', 'b1')).rejects.toThrow();
    });

    it('publishes to enabled targets and upserts a success record with canonical URL', async () => {
      prisma.blog.findUnique.mockResolvedValue(blog);
      prisma.publishTarget.findMany.mockResolvedValue([
        {
          id: 't1',
          userId: 'u1',
          platform: 'wordpress',
          credentials: '{"siteUrl":"https://x.com","token":"abcd1234"}',
        },
      ]);
      prisma.publishRecord.findUnique.mockResolvedValue(null);
      wp.publish.mockResolvedValue({
        externalId: '42',
        externalUrl: 'https://x.com/p/42',
      });
      prisma.publishTarget.update.mockResolvedValue({});

      const records = await service.publishBlog('u1', 'b1');

      const input = wp.publish.mock.calls[0][1];
      expect(input.canonicalUrl).toContain('/alice/hello');
      expect(input.existingExternalId).toBeNull();
      const upsert = prisma.publishRecord.upsert.mock.calls[0][0];
      expect(upsert.create.status).toBe('success');
      expect(upsert.create.externalId).toBe('42');
      expect(records).toHaveLength(1);
    });

    it('passes the prior external id so the adapter updates instead of duplicating', async () => {
      prisma.blog.findUnique.mockResolvedValue(blog);
      prisma.publishTarget.findMany.mockResolvedValue([
        {
          id: 't1',
          userId: 'u1',
          platform: 'devto',
          credentials: '{"apiKey":"k"}',
        },
      ]);
      prisma.publishRecord.findUnique.mockResolvedValue({ externalId: '99' });
      devto.publish.mockResolvedValue({ externalId: '99', externalUrl: 'u' });
      prisma.publishTarget.update.mockResolvedValue({});

      await service.publishBlog('u1', 'b1');
      expect(devto.publish.mock.calls[0][1].existingExternalId).toBe('99');
    });

    it('isolates a bad target (credential decrypt failure) without aborting the others', async () => {
      prisma.blog.findUnique.mockResolvedValue(blog);
      prisma.publishTarget.findMany.mockResolvedValue([
        { id: 't1', userId: 'u1', platform: 'wordpress', credentials: 'BAD' },
        { id: 't2', userId: 'u1', platform: 'wordpress', credentials: '{}' },
      ]);
      crypto.decryptJson.mockImplementation((s: string) => {
        if (s === 'BAD') throw new Error('decrypt fail');
        return JSON.parse(s);
      });
      prisma.publishRecord.findUnique.mockResolvedValue(null);
      wp.publish.mockResolvedValue({ externalId: '7', externalUrl: 'u' });
      prisma.publishTarget.update.mockResolvedValue({});

      const records = await service.publishBlog('u1', 'b1');
      expect(records).toHaveLength(2);
      // The decrypt failure was recorded as failed, not thrown.
      const statuses = prisma.publishRecord.upsert.mock.calls.map(
        (c: any) => c[0].create.status,
      );
      expect(statuses).toContain('failed');
      expect(statuses).toContain('success');
    });

    it('records a failure (not throws) when the adapter fails', async () => {
      prisma.blog.findUnique.mockResolvedValue(blog);
      prisma.publishTarget.findMany.mockResolvedValue([
        { id: 't1', userId: 'u1', platform: 'wordpress', credentials: '{}' },
      ]);
      prisma.publishRecord.findUnique.mockResolvedValue(null);
      wp.publish.mockRejectedValue(new Error('site down'));
      prisma.publishTarget.update.mockResolvedValue({});

      const records = await service.publishBlog('u1', 'b1');
      const upsert = prisma.publishRecord.upsert.mock.calls[0][0];
      expect(upsert.create.status).toBe('failed');
      expect(upsert.create.error).toContain('site down');
      expect(records).toHaveLength(1);
    });
  });

  describe('handleBlogPublished (auto fanout)', () => {
    it('no-ops when encryption is unconfigured', async () => {
      crypto.isConfigured.mockReturnValue(false);
      await service.handleBlogPublished({ blogId: 'b1', authorId: 'u1' });
      expect(prisma.publishTarget.findMany).not.toHaveBeenCalled();
    });

    it('publishes to enabled+autoPublish targets and swallows failures', async () => {
      prisma.publishTarget.findMany.mockResolvedValue([
        { id: 't1', userId: 'u1', platform: 'wordpress', credentials: '{}' },
      ]);
      prisma.blog.findUnique.mockResolvedValue(blog);
      prisma.publishRecord.findUnique.mockResolvedValue(null);
      wp.publish.mockRejectedValue(new Error('boom'));
      prisma.publishTarget.update.mockResolvedValue({});

      await expect(
        service.handleBlogPublished({ blogId: 'b1', authorId: 'u1' }),
      ).resolves.toBeUndefined();

      const where = prisma.publishTarget.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ enabled: true, autoPublish: true });
      expect(prisma.publishRecord.upsert).toHaveBeenCalled();
    });
  });
});
