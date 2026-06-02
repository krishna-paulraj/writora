import { BadRequestException } from '@nestjs/common';
import { SiteService } from './site.service';

describe('SiteService', () => {
  let service: SiteService;
  let prisma: any;
  let entitlements: any;

  beforeEach(() => {
    prisma = {
      site: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      user: { findUnique: jest.fn() },
    };
    entitlements = {
      assertCanCreateSite: jest.fn().mockResolvedValue(undefined),
      assertCustomDomain: jest.fn().mockResolvedValue(undefined),
    };
    service = new SiteService(prisma, entitlements);
  });

  describe('create', () => {
    it('rejects a non-string name (DTOs are undecorated, so the pipe will not coerce)', async () => {
      await expect(
        service.create('u1', { name: { evil: 1 }, slug: 'my-site' } as never),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.site.create).not.toHaveBeenCalled();
    });

    it('rejects a blank/missing slug', async () => {
      await expect(
        service.create('u1', { name: 'My Site', slug: '   ' }),
      ).rejects.toThrow(/slug is required/);
    });

    it('rejects a reserved slug', async () => {
      await expect(
        service.create('u1', { name: 'Admin', slug: 'admin' }),
      ).rejects.toThrow(/reserved/);
    });

    it('rejects a too-short slug', async () => {
      await expect(
        service.create('u1', { name: 'X', slug: 'ab' }),
      ).rejects.toThrow(/3–40/);
    });

    it('normalizes the slug and defaults blogTheme when not a usable string', async () => {
      prisma.site.findUnique.mockResolvedValue(null); // slug free
      prisma.site.create.mockImplementation((args: any) => ({
        id: 's1',
        ...args.data,
      }));

      await service.create('u1', {
        name: '  My Site ',
        slug: 'My Cool Site!!',
        blogTheme: 42 as never,
      });

      const data = prisma.site.create.mock.calls[0][0].data;
      expect(data.name).toBe('My Site');
      expect(data.slug).toBe('my-cool-site');
      expect(data.blogTheme).toBe('default');
      expect(data.isPrimary).toBe(false);
    });
  });

  describe('update', () => {
    it('refuses to change the slug of the primary site (#14: it tracks the username)', async () => {
      prisma.site.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        isPrimary: true,
      });

      await expect(
        service.update('u1', 's1', { slug: 'something-else' }),
      ).rejects.toThrow(/primary site URL follows your username/);
      expect(prisma.site.update).not.toHaveBeenCalled();
    });

    it('allows a slug change on a non-primary site', async () => {
      prisma.site.findUnique
        .mockResolvedValueOnce({ id: 's2', userId: 'u1', isPrimary: false }) // ensureOwned
        .mockResolvedValueOnce(null); // assertSlugFree → free
      prisma.site.update.mockResolvedValue({ id: 's2', slug: 'new-slug' });

      await service.update('u1', 's2', { slug: 'New Slug' });

      expect(prisma.site.update.mock.calls[0][0].data.slug).toBe('new-slug');
    });
  });

  describe('setCustomDomain', () => {
    beforeEach(() => {
      prisma.site.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        isPrimary: false,
      });
      prisma.site.update.mockResolvedValue({ id: 's1', customDomain: null });
    });

    it.each([
      ['-.com'],
      ['a..b.com'],
      ['.example.com'],
      ['example.com.'],
      ['-bad.example.com'],
      ['no-tld'],
      ['has space.com'],
    ])('rejects the malformed domain %p', async (domain) => {
      await expect(
        service.setCustomDomain('u1', 's1', domain),
      ).rejects.toThrow(/valid domain/);
      expect(prisma.site.update).not.toHaveBeenCalled();
    });

    it.each([['blog.example.com'], ['example.co.uk'], ['a.io']])(
      'accepts the valid domain %p',
      async (domain) => {
        await service.setCustomDomain('u1', 's1', domain);
        expect(prisma.site.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: { customDomain: domain } }),
        );
      },
    );

    it('clears the domain (null) without validation or a plan check', async () => {
      await service.setCustomDomain('u1', 's1', null);
      expect(entitlements.assertCustomDomain).not.toHaveBeenCalled();
      expect(prisma.site.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { customDomain: null } }),
      );
    });
  });
});
