export class PublishBlogDto {
  // Specific destinations to publish to; when omitted, all enabled ones.
  targetIds?: string[];
}
