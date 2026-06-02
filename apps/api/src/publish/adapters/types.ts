// What an adapter needs to publish one post, platform-agnostic.
export interface PublishBlogInput {
  blogId: string;
  title: string;
  slug: string;
  description: string;
  contentHtml: string;
  imageUrl: string | null;
  category: string;
  // Public URL of the original on Writora — set as the cross-post's canonical
  // so search engines don't treat the syndicated copy as duplicate content.
  canonicalUrl: string;
  // Remote id from a prior publish of this blog to this target, if any — lets
  // the adapter UPDATE the existing remote post instead of creating a duplicate.
  existingExternalId?: string | null;
}

export interface PublishResult {
  externalId: string;
  externalUrl: string;
}

export interface PublishAdapter {
  readonly platform: string;
  /** Throws BadRequestException when credentials are structurally invalid. */
  validate(creds: Record<string, unknown>): void;
  /** Lightweight connectivity + auth check. Never throws — returns ok/info. */
  test(creds: Record<string, unknown>): Promise<{ ok: boolean; info?: string }>;
  /** Publishes (or updates) the post. Throws on failure. */
  publish(
    creds: Record<string, unknown>,
    input: PublishBlogInput,
  ): Promise<PublishResult>;
}
