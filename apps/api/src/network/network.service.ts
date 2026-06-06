import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { UpdateNetworkDto } from './dto/update-network.dto';

@Injectable()
export class NetworkService {
  constructor(
    private prisma: PrismaService,
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

    return this.prisma.networkMembership.upsert({
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
  }
}
