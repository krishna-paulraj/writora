export class UpdateSiteDto {
  name?: string;
  slug?: string;
  blogTheme?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  twitterHandle?: string | null;
  websiteUrl?: string | null;
}
