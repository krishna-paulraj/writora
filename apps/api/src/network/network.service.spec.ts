import { Test, TestingModule } from '@nestjs/testing';
import { NetworkService } from './network.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

describe('NetworkService', () => {
  let service: NetworkService;
  let prisma: any;
  let embeddings: any;
  let entitlements: any;

  beforeEach(async () => {
    prisma = {
      networkMembership: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      backlinkEdge: { count: jest.fn().mockResolvedValue(0) },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
    embeddings = {
      embed: jest.fn().mockResolvedValue([0.1, 0.2]),
      toVectorLiteral: jest.fn((v: number[]) => `[${v.join(',')}]`),
      isConfigured: jest.fn().mockReturnValue(true),
    };
    entitlements = { assertBacklinkNetwork: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NetworkService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmbeddingService, useValue: embeddings },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get(NetworkService);
  });

  it('embeds the saved niche so matching can gate on it', async () => {
    prisma.networkMembership.upsert.mockResolvedValue({
      siteId: 's1',
      niche: 'devops tooling',
    });

    await service.upsert('u1', 's1', { niche: 'devops tooling' });

    expect(embeddings.embed).toHaveBeenCalledWith('devops tooling');
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('SET "nicheEmbedding" = $1::vector'),
      '[0.1,0.2]',
      's1',
    );
  });

  it('clears the embedding when the niche is cleared', async () => {
    prisma.networkMembership.upsert.mockResolvedValue({
      siteId: 's1',
      niche: null,
    });

    await service.upsert('u1', 's1', { niche: '' });

    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('SET "nicheEmbedding" = NULL'),
      's1',
    );
  });

  it('leaves the gate off (NULL) when embeddings are unconfigured', async () => {
    embeddings.embed.mockResolvedValue(null);
    prisma.networkMembership.upsert.mockResolvedValue({
      siteId: 's1',
      niche: 'x',
    });

    await service.upsert('u1', 's1', { niche: 'x' });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('SET "nicheEmbedding" = NULL'),
      's1',
    );
  });

  it('does not touch the embedding when the update omits niche', async () => {
    prisma.networkMembership.upsert.mockResolvedValue({
      siteId: 's1',
      niche: 'kept',
    });

    await service.upsert('u1', 's1', { enabled: false });

    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('never fails the save when the embedding refresh throws', async () => {
    embeddings.embed.mockRejectedValue(new Error('provider down'));
    prisma.networkMembership.upsert.mockResolvedValue({
      siteId: 's1',
      niche: 'x',
    });

    await expect(
      service.upsert('u1', 's1', { niche: 'x' }),
    ).resolves.toMatchObject({ siteId: 's1' });
  });
});
