export class UpdateBlogDto {
  title?: string;
  slug?: string;
  description?: string;
  content?: string;
  imageUrl?: string;
  category?: string;
  readTime?: number;
  featured?: boolean;
  published?: boolean;
}
