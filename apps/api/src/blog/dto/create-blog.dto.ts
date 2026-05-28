export class CreateBlogDto {
  title: string;
  slug: string;
  description: string;
  content: string;
  imageUrl?: string;
  category: string;
  targetKeyword?: string;
  readTime?: number;
  featured?: boolean;
  published?: boolean;
}
