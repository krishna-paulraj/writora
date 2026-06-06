import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SiteContextGuard } from '../site/site-context.guard';
import { CurrentSite } from '../site/current-site.decorator';
import { NetworkService } from './network.service';
import { UpdateNetworkDto } from './dto/update-network.dto';

@UseGuards(JwtAuthGuard, SiteContextGuard)
@Controller('network')
export class NetworkController {
  constructor(private network: NetworkService) {}

  @Get()
  get(@CurrentSite() siteId: string) {
    return this.network.getOverview(siteId);
  }

  @Put()
  update(
    @Req() req: Request,
    @CurrentSite() siteId: string,
    @Body() dto: UpdateNetworkDto,
  ) {
    const user = req.user as { id: string };
    return this.network.upsert(user.id, siteId, dto);
  }
}
