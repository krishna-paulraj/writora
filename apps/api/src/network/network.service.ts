import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { UpdateNetworkDto } from './dto/update-network.dto';

@Injectable()
export class NetworkService {
  private readonly logger = new Logger(NetworkService.name);

  constructor(
    private prisma: PrismaService,
    private embeddings: EmbeddingService,
    private entitlements: EntitlementsService,
  ) {}

  /** Membership row + backlink stats for a site (membership null if not joined). */
  async getOverview(siteId: string) {
    const [membership, inbound, outbound] = await Promise.all([
      this.prisma.networkMembership.findUnique({ where: { siteId } }),
      this.prisma.backlinkEdge.count({
        where: { toSiteId: siteId, status: 'active' },
      }),
      this.prisma.backlinkEdge.count({
        where: { fromSiteId: siteId, status: 'active' },
      }),
    ]);
    return { membership, stats: { inbound, outbound } };
  }

  /**
   * Create/update the site's membership. `siteId` comes from SiteContextGuard,
   * which has already verified the site belongs to the caller; the plan gate
   * ensures only entitled users can join.
   */
  async upsert(userId: string, siteId: string, dto: UpdateNetworkDto) {
    await this.entitlements.assertBacklinkNetwork(userId);

    const update: Prisma.NetworkMembershipUpdateInput = {};
    if (dto.enabled !== undefined) update.enabled = dto.enabled;
    if (dto.relPolicy !== undefined) update.relPolicy = dto.relPolicy;
    if (dto.maxOutboundPerPost !== undefined)
      update.maxOutboundPerPost = dto.maxOutboundPerPost;
    if (dto.niche !== undefined) update.niche = dto.niche?.trim() || null;

    const membership = await this.prisma.networkMembership.upsert({
      where: { siteId },
      create: {
        siteId,
        enabled: dto.enabled ?? true,
        relPolicy: dto.relPolicy ?? 'dofollow',
        maxOutboundPerPost: dto.maxOutboundPerPost ?? 3,
        niche: dto.niche?.trim() || null,
      },
      update,
    });

    if (dto.niche !== undefined) {
      await this.refreshNicheEmbedding(siteId, membership.niche);
    }
    return membership;
  }

  /**
   * Keep the niche's embedding in step with its text — it's what the backlink
   * matcher gates on. Best-effort: with embeddings unconfigured (or the call
   * failing) the column goes/stays NULL, which simply disables the gate for
   * this site rather than blocking the save.
   */
  private async refreshNicheEmbedding(
    siteId: string,
    niche: string | null,
  ): Promise<void> {
    try {
      const vector = niche ? await this.embeddings.embed(niche) : null;
      if (vector) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "NetworkMembership" SET "nicheEmbedding" = $1::vector WHERE "siteId" = $2`,
          this.embeddings.toVectorLiteral(vector),
          siteId,
        );
      } else {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "NetworkMembership" SET "nicheEmbedding" = NULL WHERE "siteId" = $1`,
          siteId,
        );
      }
    } catch (err) {
      this.logger.warn(
        `niche embedding refresh failed for site ${siteId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
